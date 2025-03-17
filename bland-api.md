# Bland.ai API Documentation

This document provides comprehensive documentation for the Bland.ai API, outlining all available endpoints, functions, and parameters.

Base URL: `https://api.bland.ai`

## Authentication

All API requests require authentication using your API key.

**Header Required**:
```
authorization: your_api_key_here
```

For Twilio integration, an additional header may be required:
```
encrypted_key: your_encrypted_key_here
```

## Table of Contents

1. [Calls](#calls)
   - [Send Call](#send-call)
   - [Send Call with Pathway (Simple)](#send-call-with-pathway-simple)
   - [List Calls](#list-calls)
   - [Get Call Details](#get-call-details)
   - [Analyze Call with AI](#analyze-call-with-ai)
   - [Stop Active Call](#stop-active-call)
   - [Stop All Active Calls](#stop-all-active-calls)

2. [Batches](#batches)
   - [Send a Batch of Calls](#send-a-batch-of-calls)
   - [Get Batch Details](#get-batch-details)
   - [Analyze Batch with AI](#analyze-batch-with-ai)

3. [Tools](#tools)
   - [Create a Custom Tool](#create-a-custom-tool)
   - [Update Custom Tool](#update-custom-tool)
   - [Delete Custom Tool](#delete-custom-tool)
   - [List Tools](#list-tools)

4. [Voices](#voices)
   - [Generate Audio Sample](#generate-audio-sample)
   - [List Voices](#list-voices)
   - [Get Voice Details](#get-voice-details)
   - [Update Voice](#update-voice)
   - [Delete Voice](#delete-voice)
   - [Publish Cloned Voice](#publish-cloned-voice)

5. [Inbound](#inbound)
   - [List Inbound Numbers](#list-inbound-numbers)
   - [Get Inbound Number Details](#get-inbound-number-details)
   - [Purchase Inbound Number](#purchase-inbound-number)
   - [Delete Inbound Number](#delete-inbound-number)
   - [Insert Inbound Configuration](#insert-inbound-configuration)

6. [Pathways](#pathways)
   - [Get Pathway](#get-pathway)
   - [Create Pathway Version](#create-pathway-version)
   - [Update Pathways](#update-pathways)
   - [Pathway Chat](#pathway-chat)
   - [Promote Pathway](#promote-pathway)
   - [Get Folder Pathways](#get-folder-pathways)

7. [Agents](#agents)
   - [Create Agent](#create-agent)
   - [Update Agent](#update-agent)
   - [List Agents](#list-agents)

8. [SMS](#sms)
   - [Analyze SMS](#analyze-sms)
   - [Clear SMS](#clear-sms)
   - [Get SMS Messages](#get-sms-messages)

9. [Vectors](#vectors)
   - [Create Vector](#create-vector)
   - [Get Vector](#get-vector)
   - [List Vectors](#list-vectors)
   - [Delete Vector](#delete-vector)

10. [Prompts](#prompts)
    - [Create Prompt](#create-prompt)
    - [Get Prompt](#get-prompt)
    - [List Prompts](#list-prompts)

11. [Uploads](#uploads)
    - [Upload Text](#upload-text)
    - [Upload Media](#upload-media)

12. [User & Organization](#user--organization)
    - [Get Current User](#get-current-user)
    - [Get Organization Billing Information](#get-organization-billing-information)
    - [List Self Memberships](#list-self-memberships)
    - [Update Organization Version](#update-organization-version)
    - [Update Organization Member Permissions](#update-organization-member-permissions)

13. [Accounts](#accounts)
    - [Create Account](#create-account)
    - [Delete Account](#delete-account)

14. [Event Stream](#event-stream)
    - [Get Event Stream](#get-event-stream)

---

## Calls

### Send Call

**Endpoint**: `POST /v1/calls`

Send an AI phone call with a custom objective and actions. This endpoint can be used to create dynamic phone calls where the AI agent can follow instructions, use tools, and follow a conversation pathway.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |
| encrypted_key | string | No | A special key for using a BYOT (Bring Your Own Twilio) account. Only required for sending calls from your own Twilio account. |

#### Body Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| phone_number | string | Yes | | The phone number to call. Must be a valid phone number in E.164 format. |
| pathway_id | string | No | | The pathway ID for a pathway created on the dev portal. |
| task | string | Yes (if no pathway_id) | | Instructions and information for the AI agent. |
| voice | string | No | | The voice of the AI agent to use. |
| background_track | string | No | null | An audio track to play in the background during the call. Options: "office", "cafe", "restaurant", "none" |
| first_sentence | string | No | | Makes your agent say a specific phrase for its first response. |
| wait_for_greeting | boolean | No | false | When true, the agent waits for the call recipient to speak first. |
| block_interruptions | boolean | No | false | When true, the AI will not respond to interruptions. |
| interruption_threshold | number | No | 100 | Adjusts how patient the AI is when waiting for the user to finish speaking (50-200). |
| model | string | No | "enhanced" | Select a model to use: "base", "turbo", or "enhanced". |
| temperature | float | No | 0.7 | A value between 0 and 1 that controls the randomness of the LLM. |
| dynamic_data | object[] | No | | Integrate data from external APIs into your agent's knowledge. |
| keywords | string[] | No | [] | Words that will be boosted in the transcription engine. |
| pronunciation_guide | array | No | | Guides the agent on how to say specific words. |
| transfer_phone_number | string | No | | A phone number that the agent can transfer to under specific conditions. |
| transfer_list | object | No | | Set of phone numbers the agent can transfer calls to. |
| language | string | No | "en-US" | Language for optimization of transcription, speech, etc. |
| pathway_version | integer | No | | The version number of the pathway to use. |
| local_dialing | boolean | No | false | When true, selects a "from" number matching the callee's area code. |
| voicemail_sms | boolean | No | false | When true, sends an SMS if a voicemail is left. |
| dispatch_hours | object | No | | Restricts calls to certain hours in your timezone. |
| sensitive_voicemail_detection | boolean | No | false | Uses LLM-based analysis to detect frequent voicemails. |
| noise_cancellation | boolean | No | false | Filters out background noise in the audio stream. |
| ignore_button_press | boolean | No | false | When true, disables DTMF digit presses. |
| timezone | string | No | "America/Los_Angeles" | Set the timezone for the call. |
| request_data | object | No | | Data fields available to the AI agent during the call. |
| tools | array | No | | Custom tools for the AI to interact with external systems. |
| start_time | string | No | | The time you want the call to start (format: YYYY-MM-DD HH:MM:SS -HH:MM). |
| voicemail_message | string | No | | Message to leave if voicemail is detected. |
| voicemail_action | enum | No | "hangup" | Action to take when voicemail is detected: "hangup", "leave_message", "ignore". |
| retry | object | No | | Configuration for retrying a call if it goes to voicemail. |
| max_duration | integer | No | 30 | Maximum call duration in minutes. |
| record | boolean | No | false | When true, records the phone call. |
| from | string | No | | Specify a phone number to call from that you own. |
| webhook | string | No | | URL to send call information to when the call ends. |
| webhook_events | string[] | No | | Events to stream to the webhook during the call. |
| metadata | object | No | | Additional information to associate with the call. |
| analysis_preset | string | No | | The UUID of an analysis preset to analyze the call. |
| available_tags | string[] | No | | Array of disposition tags for the AI to evaluate and apply. |
| geospatial_dialing | string | No | | UUID for the geospatial dialing pool (enterprise only). |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Can be "success" or "error". |
| call_id | string | A unique identifier for the call (present only if status is "success"). |
| batch_id | string | The batch ID of the call (present only if status is "success"). |
| message | string | A message explaining the status of the call. |
| errors | array | For validation errors, a detailed list of each field with an error. |

---

### Send Call with Pathway (Simple)

**Endpoint**: `POST /v1/calls`

A simplified endpoint for sending calls using a predefined pathway.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Body Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| phone_number | string | Yes | The phone number to call. Country code defaults to +1 (US) if not specified. |
| pathway_id | string | Yes | The ID for the conversational pathway to follow. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Can be "success" or "error". |
| call_id | string | A unique identifier for the call (present only if status is "success"). |

---

### List Calls

**Endpoint**: `GET /v1/calls`

Retrieve a list of calls with filtering options.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |
| encrypted_key | string | No | Use your own Twilio account (optional). |

#### Query Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| from_number | string | | Filter calls by the number they were dispatched from. |
| to_number | string | | Filter calls by the number they were dispatched to. |
| from | int | | The starting index (inclusive) for the range of calls. |
| to | int | | The ending index for the range of calls. |
| limit | int | 1000 | The maximum number of calls to return. |
| ascending | boolean | false | Whether to sort the calls in ascending order of creation time. |
| start_date | string | | Get calls including and after a specific date (YYYY-MM-DD). |
| end_date | string | | Get calls including and before a specific date (YYYY-MM-DD). |
| created_at | string | | Get calls for a specific date (YYYY-MM-DD). |
| completed | boolean | | Filter calls by completion status. |
| batch_id | string | | Get calls from a specific batch. |
| answered_by | string | | Filter by who answered the call (e.g., "human"). |
| inbound | boolean | | Filter based on call direction. |
| duration_gt | float | | Duration greater than the value provided (in minutes). |
| duration_lt | float | | Duration less than the value provided (in minutes). |
| campaign_id | string | | Get calls for a specific campaign ID. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| total_count | integer | The total number of calls that match the query filters. |
| count | integer | The number of calls returned in the response. |
| calls | array | An array of call data objects. |

---

### Get Call Details

**Endpoint**: `GET /v1/calls/{call_id}`

Retrieve detailed information about a specific call.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |
| encrypted_key | string | No | Use your own Twilio account (optional). |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| call_id | string | Yes | The unique identifier of the call. |

#### Response

The response includes detailed information about the call, including:

- Call metadata (ID, length, batch ID, etc.)
- Phone numbers involved (to, from)
- Request data
- Status information
- Timing details
- Variables created during the call
- Call answering details
- Recording information (if available)
- Transcripts with timestamps
- Pricing information
- Analysis data (if applicable)

---

### Analyze Call with AI

**Endpoint**: `POST /v1/calls/{call_id}/analyze`

Analyze a call using AI to extract insights and answer specific questions.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| call_id | string | Yes | The unique identifier for the call to be analyzed. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| goal | string | Yes | The overall purpose of the call, providing context for analysis. |
| questions | string[][] | Yes | An array of questions to be analyzed, each with a question text and expected answer type. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | object | Will be "success" if the request was successful. |
| message | string | Confirms success or provides an error message. |
| answers | array | Contains the analyzed answers for the call. |
| credits_used | number | Token-based price for the analysis request. |

---

### Stop Active Call

**Endpoint**: `POST /v1/calls/{call_id}/stop`

Stop an active call by its ID.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| call_id | string | Yes | The unique identifier of the call to stop. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |

---

### Stop All Active Calls

**Endpoint**: `POST /v1/calls/active/stop`

Stop all currently active calls associated with the authenticated account.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |
| stopped_count | integer | Number of calls that were stopped. |

---

## Batches

### Send a Batch of Calls

**Endpoint**: `POST /v1/batches`

Send multiple calls in a batch, using a common prompt template with variable substitution.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Body Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| base_prompt | string | Yes | The prompt or task template used for all calls, with {{variable}} placeholders. |
| call_data | array | Yes | Array of objects, each containing call-specific data including phone_number and variables. |
| from | string | No | Phone number to send batch calls from. |
| label | string | No | User-friendly label for the batch. |
| campaign_id | string | No | ID to organize related batches together. |
| test_mode | boolean | No (default: false) | When true, only dispatches the first call in call_data. |
| batch_webhook | string | No | URL to receive a POST request when the batch completes. |
| * | | No | All other parameters from the Send Call endpoint are supported. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| message | string | Status message - "success" or error details. |
| batch_id | string | The unique identifier for the batch. |

---

### Get Batch Details

**Endpoint**: `GET /v1/batches/{batch_id}`

Retrieve details about a specific batch of calls.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| batch_id | string | Yes | The unique identifier of the batch. |

#### Response

The response includes information about the batch and its calls.

---

### Analyze Batch with AI

**Endpoint**: `POST /v1/batches/{batch_id}/analyze`

Analyze all calls in a batch using AI.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| batch_id | string | Yes | The unique identifier of the batch to analyze. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| goal | string | Yes | The overall purpose or context for the analysis. |
| questions | string[][] | Yes | Array of questions to analyze, each with question text and expected answer type. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |
| results | array | Analysis results for each call in the batch. |

---

## Tools

### Create a Custom Tool

**Endpoint**: `POST /v1/tools`

Create a custom tool that AI agents can use during calls to interact with external systems.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Body Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| name | string | Yes | | The name that the AI using the tool will see. |
| description | string | Yes | | Description of what the tool does or special instructions. |
| speech | string | No | | Text that the AI will say while using the tool. |
| url | string | Yes | | The endpoint of the external API that the tool will call. |
| method | string | No | "GET" | HTTP method to use ("GET" or "POST"). |
| headers | object | No | | Headers to send to the external API (supports prompt variables). |
| body | object | No | | Body to send to the external API (supports prompt variables). |
| query | object | No | | Query parameters to append to the URL (supports prompt variables). |
| input_schema | object | No | | Schema that AI input must match for tool use. |
| response | object | No | | Configuration for extracting data from the API response. |
| timeout | number | No | 10000 | Maximum wait time in milliseconds for the external API response. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Whether the tool creation succeeded. |
| tool_id | string | A unique ID to reference the tool in the future. |

---

### Update Custom Tool

**Endpoint**: `POST /v1/tools/{tool_id}`

Update an existing custom tool.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| tool_id | string | Yes | The ID of the custom tool to update. |

#### Body Parameters

Same as the Create a Custom Tool endpoint.

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Whether the tool update succeeded. |
| tool_id | string | The ID of the updated tool. |

---

### Delete Custom Tool

**Endpoint**: `DELETE /v1/tools/{tool_id}`

Delete a custom tool.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| tool_id | string | Yes | The ID of the custom tool to delete. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |

---

### List Tools

**Endpoint**: `GET /v1/tools`

Retrieve a list of custom tools.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| tools | array | Array of custom tool objects. |
| count | integer | Number of tools returned. |

---

## Voices

### Generate Audio Sample

**Endpoint**: `POST /v1/voices/{id}/sample`

Generate an audio sample using a specific voice.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | The ID or name of the voice to use. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| text | string | Yes | The text content to be spoken (maximum 200 characters). |
| voice_settings | object | No | Override the preset's default voice settings. |
| language | string | No | The language of the text content (default: "ENG"). |

#### Response

Returns the generated audio file.

---

### List Voices

**Endpoint**: `GET /v1/voices`

Retrieve a list of available voices.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| voices | array | Array of available voice objects. |
| count | integer | Number of voices returned. |

---

### Get Voice Details

**Endpoint**: `GET /v1/voices/{id}`

Get details about a specific voice.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | The ID of the voice to retrieve. |

#### Response

Detailed information about the voice and its settings.

---

### Update Voice

**Endpoint**: `PATCH /v1/voices/{id}`

Update a voice's settings.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | The ID of the voice to update. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | No | New name for the voice. |
| settings | object | No | Updated voice settings. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |

---

### Delete Voice

**Endpoint**: `DELETE /v1/voices/{id}`

Delete a voice.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | The ID of the voice to delete. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |

---

### Publish Cloned Voice

**Endpoint**: `POST /v1/{voiceId}/publish`

Publish a cloned voice for use in calls.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| voiceId | string | Yes | The ID of the cloned voice to publish. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |

---

## Inbound

### List Inbound Numbers

**Endpoint**: `GET /v1/inbound`

List all inbound phone numbers associated with the account.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |
| encrypted_key | string | No | For listing numbers from your own Twilio account. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| numbers | array | Array of inbound number objects. |
| count | integer | Number of inbound numbers returned. |

---

### Get Inbound Number Details

**Endpoint**: `GET /v1/inbound-number`

Get details about a specific inbound number.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |
| encrypted_key | string | No | For accessing numbers from your own Twilio account. |

#### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| phone_number | string | Yes | The inbound phone number to get details for. |

#### Response

Detailed information about the inbound number configuration.

---

### Purchase Inbound Number

**Endpoint**: `POST /v1/inbound-purchase`

Purchase a new inbound phone number.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| area_code | string | Yes | The area code to purchase a number in. |
| country_code | string | No | Country code (default: "US"). |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |
| phone_number | string | The purchased phone number. |

---

### Delete Inbound Number

**Endpoint**: `POST /v1/inbound-number-delete`

Release an inbound phone number.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |
| encrypted_key | string | No | For deleting numbers from your own Twilio account. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| phone_number | string | Yes | The phone number to delete. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |

---

### Insert Inbound Configuration

**Endpoint**: `POST /v1/inbound-insert`

Configure an inbound number with an AI agent.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |
| encrypted_key | string | No | For configuring numbers from your own Twilio account. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| phone_number | string | Yes | The inbound phone number to configure. |
| task | string | No | The prompt for the AI agent answering the calls. |
| pathway_id | string | No | The ID of a pathway for the AI to follow. |
| voice | string | No | The voice for the AI agent to use. |
| language | string | No | The language for optimization (default: "en-US"). |
| max_duration | integer | No | Maximum call duration in minutes (default: 30). |
| record | boolean | No | Whether to record inbound calls (default: false). |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |

---

## Pathways

### Get Pathway

**Endpoint**: `GET /v1/pathway`

Get details about a specific pathway.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | The ID of the pathway to retrieve. |
| version | integer | No | The specific version to retrieve (default: latest). |

#### Response

Detailed information about the pathway and its nodes.

---

### Create Pathway Version

**Endpoint**: `POST /v1/create_pathway_version`

Create a new version of an existing pathway.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| pathway_id | string | Yes | The ID of the pathway to create a version for. |
| nodes | array | Yes | Array of node configurations for the new version. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| version | integer | The newly created version number. |

---

### Update Pathways

**Endpoint**: `POST /v1/update_pathways`

Update an existing pathway.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| pathway_id | string | Yes | The ID of the pathway to update. |
| name | string | No | New name for the pathway. |
| description | string | No | New description for the pathway. |
| nodes | array | No | Updated node configurations. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |

---

### Pathway Chat

**Endpoint**: `POST /v1/pathway-chat`

Test a pathway through a chat interface.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| pathway_id | string | Yes | The ID of the pathway to test. |
| version | integer | No | The specific version to test (default: latest). |
| user_message | string | Yes | The user message to process through the pathway. |
| session_id | string | No | Session ID for continuing a conversation. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| response | string | The AI's response based on the pathway. |
| session_id | string | ID for continuing the conversation. |
| path | array | The nodes traversed in the pathway. |

---

### Promote Pathway

**Endpoint**: `POST /v1/pathway-promote`

Promote a specific pathway version to production.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| pathway_id | string | Yes | The ID of the pathway. |
| version | integer | Yes | The version to promote to production. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |

---

### Get Folder Pathways

**Endpoint**: `GET /v1/folder_pathways`

Get all pathways in a specific folder.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| folder_id | string | Yes | The ID of the folder. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| pathways | array | Array of pathway objects in the folder. |
| count | integer | Number of pathways returned. |

---

## Agents

### Create Agent

**Endpoint**: `POST /v1/agents`

Create a new AI agent.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Name for the agent. |
| description | string | No | Description of the agent. |
| task | string | Yes | The prompt or instructions for the agent. |
| voice | string | No | The voice ID or name for the agent. |
| language | string | No | The language for optimization (default: "en-US"). |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| agent_id | string | The ID of the created agent. |

---

### Update Agent

**Endpoint**: `POST /v1/agents/{id}`

Update an existing agent.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | The ID of the agent to update. |

#### Request Body

Same as the Create Agent endpoint.

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |

---

### List Agents

**Endpoint**: `GET /v1/agents`

List all agents associated with the account.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| agents | array | Array of agent objects. |
| count | integer | Number of agents returned. |

---

## SMS

### Analyze SMS

**Endpoint**: `POST /v1/sms-analyze`

Analyze SMS messages using AI.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| phone_number | string | Yes | The phone number to analyze messages for. |
| goal | string | Yes | The context or purpose of the analysis. |
| questions | string[][] | Yes | Questions to analyze, each with question text and expected answer type. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| answers | array | Analysis results for each question. |

---

### Clear SMS

**Endpoint**: `POST /v1/sms-clear`

Clear SMS message history for a phone number.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| phone_number | string | Yes | The phone number to clear SMS history for. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |

---

### Get SMS Messages

**Endpoint**: `POST /v1/sms-get-messages`

Retrieve SMS message history for a phone number.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| phone_number | string | Yes | The phone number to get messages for. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| messages | array | Array of SMS message objects. |
| count | integer | Number of messages returned. |

---

## Vectors

### Create Vector

**Endpoint**: `POST /v1/vectors`

Create a new vector for semantic search.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| text | string | Yes | The text to vectorize. |
| metadata | object | No | Additional metadata to store with the vector. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| vector_id | string | The ID of the created vector. |

---

### Get Vector

**Endpoint**: `GET /v1/vectors/{id}`

Get details about a specific vector.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | The ID of the vector to retrieve. |

#### Response

Detailed information about the vector.

---

### List Vectors

**Endpoint**: `GET /v1/vectors`

List all vectors associated with the account.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| vectors | array | Array of vector objects. |
| count | integer | Number of vectors returned. |

---

### Delete Vector

**Endpoint**: `DELETE /v1/vectors/{id}`

Delete a vector.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | The ID of the vector to delete. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |

---

## Prompts

### Create Prompt

**Endpoint**: `POST /v1/prompts`

Create a new reusable prompt template.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Name for the prompt. |
| description | string | No | Description of the prompt. |
| template | string | Yes | The prompt template with {{variable}} placeholders. |
| variables | array | No | Array of variable definitions for the template. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| prompt_id | string | The ID of the created prompt. |

---

### Get Prompt

**Endpoint**: `GET /v1/prompts/{id}`

Get details about a specific prompt.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | The ID of the prompt to retrieve. |

#### Response

Detailed information about the prompt and its template.

---

### List Prompts

**Endpoint**: `GET /v1/prompts`

List all prompts associated with the account.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| prompts | array | Array of prompt objects. |
| count | integer | Number of prompts returned. |

---

## Uploads

### Upload Text

**Endpoint**: `POST /v1/upload-text`

Upload text content for processing.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| text | string | Yes | The text content to upload. |
| metadata | object | No | Additional metadata about the text. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| upload_id | string | The ID of the uploaded text. |

---

### Upload Media

**Endpoint**: `POST /v1/upload-media`

Upload media files (audio, images) for processing.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |
| Content-Type | string | Yes | Set to "multipart/form-data". |

#### Form Data

| Name | Type | Required | Description |
|------|------|----------|-------------|
| file | file | Yes | The media file to upload. |
| metadata | string | No | JSON string with additional metadata. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| upload_id | string | The ID of the uploaded media. |
| url | string | The URL where the media can be accessed. |

---

## User & Organization

### Get Current User

**Endpoint**: `GET /v1/me`

Get information about the currently authenticated user.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Response

Information about the user and their account.

---

### Get Organization Billing Information

**Endpoint**: `GET /v1/org_billing_information`

Get billing information for the organization.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Response

Detailed billing information for the organization.

---

### List Self Memberships

**Endpoint**: `GET /v1/org_list_self_memberships`

List all organizations the current user is a member of.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| memberships | array | Array of organization membership objects. |

---

### Update Organization Version

**Endpoint**: `PATCH /v1/org_version`

Update the API version used by the organization.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| version | string | Yes | The API version to switch to. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |

---

### Update Organization Member Permissions

**Endpoint**: `PATCH /v1/org_member_permissions`

Update the permissions for an organization member.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| member_id | string | Yes | The ID of the member to update. |
| permissions | array | Yes | Array of permission objects. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |

---

## Accounts

### Create Account

**Endpoint**: `POST /v1/accounts`

Create a new sub-account.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Name for the sub-account. |
| email | string | Yes | Email address for the sub-account. |
| credits | number | No | Initial credits to allocate (default: 0). |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| account_id | string | The ID of the created sub-account. |
| api_key | string | API key for the sub-account. |

---

### Delete Account

**Endpoint**: `POST /v1/accounts-delete`

Delete a sub-account.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Request Body

| Name | Type | Required | Description |
|------|------|----------|-------------|
| account_id | string | Yes | The ID of the sub-account to delete. |

#### Response

| Name | Type | Description |
|------|------|-------------|
| status | string | Status of the operation ("success" or "error"). |
| message | string | Description of the result. |

---

## Event Stream

### Get Event Stream

**Endpoint**: `GET /v1/event-stream`

Connect to a Server-Sent Events (SSE) stream for real-time events.

#### Headers

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authorization | string | Yes | Your API key for authentication. |

#### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| events | string | No | Comma-separated list of event types to subscribe to. |

#### Response

A Server-Sent Events stream with real-time events in the format:

```
event: event_type
data: {"event_data": "..."}
```

---

## Language Support

Bland.ai supports a wide range of languages for voice and transcription. Available options include:

- `auto` - Auto Detect
- `en` - English
  - `en-US` - English (US)
  - `en-GB` - English (UK)
  - `en-AU` - English (Australia)
  - `en-NZ` - English (New Zealand)
  - `en-IN` - English (India)
- `zh` - Chinese (Mandarin, Simplified)
  - `zh-CN` - Chinese (Mandarin, Simplified, China)
  - `zh-Hans` - Chinese (Mandarin, Simplified, Hans)
- `zh-TW` - Chinese (Mandarin, Traditional)
  - `zh-Hant` - Chinese (Mandarin, Traditional, Hant)
- `es` - Spanish
  - `es-419` - Spanish (Latin America)
- `fr` - French
  - `fr-CA` - French (Canada)
- `de` - German
- `el` - Greek
- `hi` - Hindi
  - `hi-Latn` - Hindi (Latin script)
- `ja` - Japanese
- `ko` - Korean
  - `ko-KR` - Korean (Korea)
- `pt` - Portuguese
  - `pt-BR` - Portuguese (Brazil)
  - `pt-PT` - Portuguese (Portugal)
- `it` - Italian
- `nl` - Dutch
- `pl` - Polish
- `ru` - Russian
- `sv` - Swedish
  - `sv-SE` - Swedish (Sweden)
- `da` - Danish
  - `da-DK` - Danish (Denmark)
- `fi` - Finnish
- `id` - Indonesian
- `ms` - Malay
- `tr` - Turkish
- `uk` - Ukrainian
- `bg` - Bulgarian
- `cs` - Czech
- `ro` - Romanian
- `sk` - Slovak
- `hu` - Hungarian
- `no` - Norwegian
- `vi` - Vietnamese
- `babel` - Babel (Experimental multilingual transcription)

## Rate Limits

By default, Bland customers can dispatch 100 calls/day before hitting rate limits.

Enterprise customers start at 20,000 calls per hour, and 100,000 calls per day.

To raise your rate limits or discuss limits larger than what's offered on enterprise, contact Bland.ai support.

## Error Handling

API errors are returned with appropriate HTTP status codes and include a JSON response with the following structure:

```json
{
  "status": "error",
  "message": "Description of the error",
  "errors": [
    "Detailed error message 1",
    "Detailed error message 2"
  ]
}
```

Common error responses include:
- 400: Bad Request - Invalid parameters or request structure
- 401: Unauthorized - Invalid or missing API key
- 403: Forbidden - Insufficient permissions
- 404: Not Found - Resource not found
- 429: Too Many Requests - Rate limit exceeded
- 500: Internal Server Error - Server-side issue

## Webhooks

Bland.ai can send webhook notifications for various events including call completion and batch completion. Configure webhook URLs in the API request or in the dashboard.

Webhook payloads include detailed information about the event and related resources.
