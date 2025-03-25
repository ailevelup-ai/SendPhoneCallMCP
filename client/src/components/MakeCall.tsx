import React, { useState } from 'react';
import {
  Box,
  Button,
  Input,
  VStack,
  Text,
} from '@chakra-ui/react';
import { useToast } from '@chakra-ui/toast';
import {
  FormControl,
  FormLabel,
  FormHelperText,
} from '@chakra-ui/form-control';
import {
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from '@chakra-ui/number-input';
import { Collapse } from '@chakra-ui/transition';
import { ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';

interface CallOptions {
  maxDuration?: number;
  temperature?: number;
  model?: string;
  voiceId?: string;
}

const MakeCall: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [task, setTask] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState<CallOptions>({});
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setPhoneNumber(value);
  };

  const formatPhoneNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return '(' + match[1] + ') ' + match[2] + '-' + match[3];
    }
    return number;
  };

  const handleSubmit = async () => {
    if (!phoneNumber || phoneNumber.length !== 10) {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid 10-digit phone number',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (!task.trim()) {
      toast({
        title: 'Task required',
        description: 'Please enter a task for the AI to perform',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/calls/outbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toNumber: phoneNumber,
          task,
          options,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate call');
      }

      const data = await response.json();
      toast({
        title: 'Call initiated successfully',
        description: `Call ID: ${data.callId}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      setPhoneNumber('');
      setTask('');
      setOptions({});
    } catch (error) {
      toast({
        title: 'Error initiating call',
        description: 'Please try again later',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <VStack gap={6} alignItems="stretch">
      <FormControl isRequired>
        <FormLabel>Phone Number</FormLabel>
        <Input
          placeholder="(555) 555-5555"
          value={formatPhoneNumber(phoneNumber)}
          onChange={handlePhoneNumberChange}
          maxLength={14}
        />
        <FormHelperText>Enter the recipient's phone number</FormHelperText>
      </FormControl>

      <FormControl isRequired>
        <FormLabel>Task</FormLabel>
        <Input
          placeholder="e.g., Schedule an appointment for next week"
          value={task}
          onChange={(e) => setTask(e.target.value)}
        />
        <FormHelperText>
          Describe what you want the AI to accomplish in this call
        </FormHelperText>
      </FormControl>

      <Box>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Text>Advanced Options</Text>
          {showAdvanced ? <ChevronUpIcon ml={2} /> : <ChevronDownIcon ml={2} />}
        </Button>

        <Collapse in={showAdvanced}>
          <Box pt={4}>
            <VStack gap={4} alignItems="stretch">
              <FormControl>
                <FormLabel>Max Duration (seconds)</FormLabel>
                <NumberInput
                  min={30}
                  max={1800}
                  value={options.maxDuration}
                  onChange={(value) =>
                    setOptions({ ...options, maxDuration: Number(value) })
                  }
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <FormHelperText>
                  Maximum duration of the call (30-1800 seconds)
                </FormHelperText>
              </FormControl>

              <FormControl>
                <FormLabel>Temperature</FormLabel>
                <NumberInput
                  min={0}
                  max={2}
                  step={0.1}
                  value={options.temperature}
                  onChange={(value) =>
                    setOptions({ ...options, temperature: Number(value) })
                  }
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <FormHelperText>
                  Controls randomness in responses (0-2)
                </FormHelperText>
              </FormControl>

              <FormControl>
                <FormLabel>Model</FormLabel>
                <Input
                  placeholder="Optional: Specify model"
                  value={options.model || ''}
                  onChange={(e) =>
                    setOptions({ ...options, model: e.target.value })
                  }
                />
                <FormHelperText>Leave blank for default model</FormHelperText>
              </FormControl>

              <FormControl>
                <FormLabel>Voice ID</FormLabel>
                <Input
                  placeholder="Optional: Specify voice ID"
                  value={options.voiceId || ''}
                  onChange={(e) =>
                    setOptions({ ...options, voiceId: e.target.value })
                  }
                />
                <FormHelperText>Leave blank for default voice</FormHelperText>
              </FormControl>
            </VStack>
          </Box>
        </Collapse>
      </Box>

      <Button
        colorScheme="blue"
        onClick={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? 'Initiating call...' : 'Make Call'}
      </Button>
    </VStack>
  );
};

export default MakeCall; 