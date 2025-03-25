import React, { useState } from 'react';
import {
  Box,
  Button,
  Input,
  VStack,
  Text,
  Spinner,
} from '@chakra-ui/react';
import { useToast } from '@chakra-ui/toast';
import { List, ListItem } from '@chakra-ui/layout';

interface PhoneNumber {
  phoneNumber: string;
  friendlyName: string;
}

interface PhoneNumberSearchProps {
  onNumberPurchased: () => void;
}

const PhoneNumberSearch: React.FC<PhoneNumberSearchProps> = ({ onNumberPurchased }) => {
  const [areaCode, setAreaCode] = useState('');
  const [searchResults, setSearchResults] = useState<PhoneNumber[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const toast = useToast();

  const handleAreaCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setAreaCode(value);
  };

  const searchPhoneNumbers = async () => {
    if (!areaCode || areaCode.length !== 3) {
      toast({
        title: 'Invalid area code',
        description: 'Please enter a valid 3-digit area code',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/phone-numbers/search?areaCode=${areaCode}`);
      if (!response.ok) {
        throw new Error('Failed to search phone numbers');
      }
      const data = await response.json();
      setSearchResults(data.phoneNumbers);
    } catch (error) {
      toast({
        title: 'Error searching phone numbers',
        description: 'Please try again later',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSearching(false);
    }
  };

  const purchasePhoneNumber = async (phoneNumber: string) => {
    setIsPurchasing(true);
    try {
      const response = await fetch('/api/phone-numbers/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber }),
      });

      if (!response.ok) {
        throw new Error('Failed to purchase phone number');
      }

      toast({
        title: 'Phone number purchased successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onNumberPurchased();
    } catch (error) {
      toast({
        title: 'Error purchasing phone number',
        description: 'Please try again later',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const formatPhoneNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return '(' + match[1] + ') ' + match[2] + '-' + match[3];
    }
    return number;
  };

  return (
    <VStack gap={4} alignItems="stretch">
      <Box>
        <Text mb={2}>Enter a 3-digit area code to search for available numbers:</Text>
        <Box display="flex" gap={4}>
          <Input
            placeholder="Area code"
            value={areaCode}
            onChange={handleAreaCodeChange}
            maxLength={3}
            width="100px"
          />
          <Button
            colorScheme="blue"
            onClick={searchPhoneNumbers}
            disabled={isSearching}
            loading={isSearching}
            loadingText="Searching..."
          >
            Search
          </Button>
        </Box>
      </Box>

      {searchResults.length > 0 && (
        <Box>
          <Text mb={2}>Available phone numbers:</Text>
          <List>
            {searchResults.map((result) => (
              <ListItem
                key={result.phoneNumber}
                p={4}
                border="1px"
                borderColor="gray.200"
                borderRadius="md"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={3}
              >
                <Text>{formatPhoneNumber(result.phoneNumber)}</Text>
                <Button
                  colorScheme="green"
                  size="sm"
                  onClick={() => purchasePhoneNumber(result.phoneNumber)}
                  disabled={isPurchasing}
                  loading={isPurchasing}
                  loadingText="Purchasing..."
                >
                  Purchase
                </Button>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {isSearching && (
        <Box textAlign="center">
          <Spinner />
          <Text mt={2}>Searching for available numbers...</Text>
        </Box>
      )}
    </VStack>
  );
};

export default PhoneNumberSearch; 