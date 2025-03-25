import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Text,
  VStack,
  Spinner,
} from '@chakra-ui/react';
import { useToast } from '@chakra-ui/toast';
import { Divider } from '@chakra-ui/layout';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/modal';

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  createdAt: string;
}

interface PhoneNumberManagerProps {
  onNumberReleased: () => void;
}

const PhoneNumberManager: React.FC<PhoneNumberManagerProps> = ({ onNumberReleased }) => {
  const [phoneNumber, setPhoneNumber] = useState<PhoneNumber | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const toast = useToast();
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetchPhoneNumber();
  }, []);

  const fetchPhoneNumber = async () => {
    try {
      const response = await fetch('/api/phone-numbers/dedicated');
      if (!response.ok) {
        throw new Error('Failed to fetch phone number');
      }
      const data = await response.json();
      setPhoneNumber(data);
    } catch (error) {
      toast({
        title: 'Error fetching phone number',
        description: 'Please try again later',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!phoneNumber) return;

    setIsReleasing(true);
    try {
      const response = await fetch(`/api/phone-numbers/${phoneNumber.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to release phone number');
      }

      toast({
        title: 'Phone number released successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setPhoneNumber(null);
      onNumberReleased();
    } catch (error) {
      toast({
        title: 'Error releasing phone number',
        description: 'Please try again later',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsReleasing(false);
      setIsDialogOpen(false);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <Box textAlign="center" py={8}>
        <Spinner />
        <Text mt={2}>Loading phone number details...</Text>
      </Box>
    );
  }

  if (!phoneNumber) {
    return (
      <Box textAlign="center" py={8}>
        <Text>No dedicated phone number found.</Text>
      </Box>
    );
  }

  return (
    <Box>
      <VStack gap={4} alignItems="stretch">
        <Box>
          <Text fontSize="lg" fontWeight="bold">
            Your Dedicated Phone Number
          </Text>
          <Text fontSize="2xl" color="blue.600">
            {formatPhoneNumber(phoneNumber.phoneNumber)}
          </Text>
        </Box>

        <Divider />

        <Box>
          <Text color="gray.600">
            Purchased on {formatDate(phoneNumber.createdAt)}
          </Text>
        </Box>

        <Box>
          <Button
            colorScheme="red"
            onClick={() => setIsDialogOpen(true)}
            disabled={isReleasing}
            loading={isReleasing}
            loadingText="Releasing..."
          >
            Release Number
          </Button>
        </Box>
      </VStack>

      <AlertDialog
        isOpen={isDialogOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsDialogOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Release Phone Number
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to release this phone number? This action
              cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleRelease}
                ml={3}
                disabled={isReleasing}
                loading={isReleasing}
                loadingText="Releasing..."
              >
                Release
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default PhoneNumberManager; 