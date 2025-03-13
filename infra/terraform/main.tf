/**
 * Terraform configuration for deploying the Bland.AI MCP to AWS
 */

provider "aws" {
  region = var.aws_region
}

# Configure backend for storing Terraform state
terraform {
  backend "s3" {
    bucket = "bland-ai-mcp-terraform-state"
    key    = "terraform.tfstate"
    region = "us-east-1"
  }
}

# Variables (defined in variables.tf)
variable "aws_region" {
  description = "AWS region to deploy resources"
  default     = "us-east-1"
}

variable "app_name" {
  description = "Application name"
  default     = "bland-ai-mcp"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  default     = "dev"
}

# Lambda function for call polling
resource "aws_lambda_function" "call_updater" {
  function_name    = "${var.app_name}-call-updater-${var.environment}"
  filename         = "../deployment/lambda-call-updater.zip"
  handler          = "lambda-call-updater.handler"
  runtime          = "nodejs18.x"
  timeout          = 300  # 5 minutes
  memory_size      = 256

  # Set concurrency to 1 to prevent concurrent executions
  reserved_concurrent_executions = 1

  environment {
    variables = {
      NODE_ENV                   = var.environment
      GOOGLE_SHEETS_DOC_ID       = var.google_sheets_doc_id
      GOOGLE_SHEETS_CLIENT_EMAIL = var.google_sheets_client_email
      GOOGLE_SHEETS_PRIVATE_KEY  = var.google_sheets_private_key
      SUPABASE_URL               = var.supabase_url
      SUPABASE_SERVICE_KEY       = var.supabase_service_key
      SUPABASE_ANON_KEY          = var.supabase_anon_key
    }
  }

  role = aws_iam_role.lambda_exec.arn

  # DLQ for failed executions
  dead_letter_config {
    target_arn = aws_sqs_queue.lambda_dlq.arn
  }

  tags = {
    Name        = "${var.app_name}-call-updater-${var.environment}"
    Environment = var.environment
  }
}

# CloudWatch event to trigger Lambda every 5 minutes
resource "aws_cloudwatch_event_rule" "call_updater_schedule" {
  name                = "${var.app_name}-call-updater-schedule-${var.environment}"
  description         = "Trigger call updater Lambda every 5 minutes"
  schedule_expression = "rate(5 minutes)"
}

resource "aws_cloudwatch_event_target" "call_updater_target" {
  rule      = aws_cloudwatch_event_rule.call_updater_schedule.name
  target_id = "call_updater"
  arn       = aws_lambda_function.call_updater.arn
}

resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.call_updater.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.call_updater_schedule.arn
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_exec" {
  name = "${var.app_name}-lambda-exec-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# CloudWatch logs policy
resource "aws_iam_policy" "lambda_logging" {
  name        = "${var.app_name}-lambda-logging-${var.environment}"
  description = "IAM policy for logging from Lambda"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Effect   = "Allow"
      Resource = "arn:aws:logs:*:*:*"
    }]
  })
}

# Attach logging policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_logging.arn
}

# SQS for Lambda DLQ
resource "aws_sqs_queue" "lambda_dlq" {
  name                      = "${var.app_name}-lambda-dlq-${var.environment}"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 1209600  # 14 days
  receive_wait_time_seconds = 10

  tags = {
    Name        = "${var.app_name}-lambda-dlq-${var.environment}"
    Environment = var.environment
  }
}

# S3 bucket for static assets and recordings
resource "aws_s3_bucket" "assets" {
  bucket = "${var.app_name}-assets-${var.environment}"

  tags = {
    Name        = "${var.app_name}-assets-${var.environment}"
    Environment = var.environment
  }
}

# Bucket policy for assets
resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.assets.arn}/*"
        Condition = {
          StringLike = {
            "aws:Referer" = ["https://${aws_cloudfront_distribution.app.domain_name}/*"]
          }
        }
      }
    ]
  })
}

# EC2 instance for application server
resource "aws_instance" "app_server" {
  ami                    = "ami-0c55b159cbfafe1f0"  # Amazon Linux 2
  instance_type          = "t3.small"
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  subnet_id              = var.subnet_id

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  user_data = <<-EOF
    #!/bin/bash
    yum update -y
    yum install -y nodejs npm git
    
    # Install PM2 for process management
    npm install -g pm2
    
    # Clone application repository
    git clone https://github.com/ailevelup-ai/SendPhoneCallMCP.git /home/ec2-user/app
    
    # Set up application
    cd /home/ec2-user/app
    npm install
    
    # Create .env file
    cat > /home/ec2-user/app/.env <<EOL
    NODE_ENV=${var.environment}
    PORT=3040
    BLAND_ENTERPRISE_API_KEY=${var.bland_api_key}
    BLAND_DEFAULT_VOICE=${var.bland_default_voice}
    BLAND_DEFAULT_FROM_NUMBER=${var.bland_default_from_number}
    BLAND_DEFAULT_MODEL=${var.bland_default_model}
    BLAND_DEFAULT_TEMPERATURE=${var.bland_default_temperature}
    BLAND_DEFAULT_VOICEMAIL_ACTION=${var.bland_default_voicemail_action}
    BLAND_ANSWERED_BY_ENABLED=${var.bland_answered_by_enabled}
    SUPABASE_URL=${var.supabase_url}
    SUPABASE_SERVICE_KEY=${var.supabase_service_key}
    SUPABASE_ANON_KEY=${var.supabase_anon_key}
    GOOGLE_SHEETS_DOC_ID=${var.google_sheets_doc_id}
    GOOGLE_SHEETS_CLIENT_EMAIL=${var.google_sheets_client_email}
    GOOGLE_SHEETS_PRIVATE_KEY=${var.google_sheets_private_key}
    JWT_SECRET=${var.jwt_secret}
    EOL
    
    # Build client
    npm run build
    
    # Start application with PM2
    pm2 start server.js --name "bland-ai-mcp" -- --production
    pm2 start poll-call-updates.js --name "bland-ai-poll"
    
    # Save PM2 configuration
    pm2 save
    
    # Set PM2 to start on boot
    pm2 startup | tail -1 | bash
  EOF

  tags = {
    Name        = "${var.app_name}-server-${var.environment}"
    Environment = var.environment
  }
}

# Security group for EC2 instance
resource "aws_security_group" "app_sg" {
  name        = "${var.app_name}-sg-${var.environment}"
  description = "Security group for Bland.AI MCP application"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Restrict this in production
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.app_name}-sg-${var.environment}"
    Environment = var.environment
  }
}

# CloudFront distribution for serving application
resource "aws_cloudfront_distribution" "app" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"  # US, Canada, Europe

  origin {
    domain_name = aws_instance.app_server.public_dns
    origin_id   = "app-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "app-origin"

    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name        = "${var.app_name}-cloudfront-${var.environment}"
    Environment = var.environment
  }
}

# CloudWatch alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.app_name}-lambda-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "This alarm monitors for errors in the call updater Lambda"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  dimensions = {
    FunctionName = aws_lambda_function.call_updater.function_name
  }
}

# SNS topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.app_name}-alerts-${var.environment}"
}

# Output the CloudFront URL
output "app_url" {
  value = "https://${aws_cloudfront_distribution.app.domain_name}"
}

# Output the EC2 instance IP
output "instance_ip" {
  value = aws_instance.app_server.public_ip
}

# Output the Lambda ARN
output "lambda_arn" {
  value = aws_lambda_function.call_updater.arn
} 