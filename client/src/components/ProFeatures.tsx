import React, { useState } from 'react';
import {
  Box,
  Container,
  Text,
} from '@chakra-ui/react';
import {
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from '@chakra-ui/tabs';
import {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/alert';
import PhoneNumberSearch from './PhoneNumberSearch';
import PhoneNumberManager from './PhoneNumberManager';
import MakeCall from './MakeCall';

interface PhoneNumberSearchProps {
  onNumberPurchased: () => void;
}

interface PhoneNumberManagerProps {
  onNumberReleased: () => void;
}

const ProFeatures: React.FC = () => {
  const [hasPhoneNumber, setHasPhoneNumber] = useState(false);

  return (
    <Container maxW="container.lg" py={8}>
      <Box mb={8}>
        <Text fontSize="3xl" fontWeight="bold" mb={2}>
          Pro Features
        </Text>
        <Text color="gray.600">
          Manage your dedicated phone number and make AI-powered calls
        </Text>
      </Box>

      {!hasPhoneNumber ? (
        <Box mb={8}>
          <Alert
            status="info"
            variant="subtle"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
            borderRadius="lg"
            p={6}
          >
            <AlertIcon boxSize="40px" mr={0} />
            <AlertTitle mt={4} mb={1} fontSize="lg">
              Get Started with Your Dedicated Number
            </AlertTitle>
            <AlertDescription maxWidth="sm">
              To make AI-powered calls, you'll first need to get a dedicated phone
              number. Search and select a number to begin.
            </AlertDescription>
          </Alert>
          <Box mt={8}>
            <PhoneNumberSearch onNumberPurchased={() => setHasPhoneNumber(true)} />
          </Box>
        </Box>
      ) : (
        <Tabs variant="enclosed" colorScheme="blue">
          <TabList>
            <Tab>Make a Call</Tab>
            <Tab>Manage Phone Number</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <MakeCall />
            </TabPanel>
            <TabPanel>
              <PhoneNumberManager
                onNumberReleased={() => setHasPhoneNumber(false)}
              />
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
    </Container>
  );
};

export default ProFeatures; 