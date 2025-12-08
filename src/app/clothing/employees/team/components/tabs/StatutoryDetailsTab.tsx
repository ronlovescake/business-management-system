import {
  Box,
  Card,
  Divider,
  Grid,
  ScrollArea,
  Stack,
  Text,
  Title,
} from '@mantine/core';

interface StatutoryDetail {
  label: string;
  value: string;
}

interface StatutoryDetailsTabProps {
  statutoryDetails: StatutoryDetail[];
  contributionDetails: StatutoryDetail[];
}

export function StatutoryDetailsTab({
  statutoryDetails,
  contributionDetails,
}: StatutoryDetailsTabProps) {
  return (
    <Stack gap="lg">
      <Card withBorder padding="lg">
        <Stack gap="md">
          <Stack gap={2}>
            <Title order={4}>Statutory Details</Title>
            <Text size="sm" c="dimmed">
              Government IDs and payroll-linked accounts on file
            </Text>
          </Stack>
          <Divider />
          <ScrollArea h="70vh">
            <Stack gap="lg" pr="sm">
              <Grid gutter="md">
                {statutoryDetails.map((detail) => (
                  <Grid.Col
                    span={{ base: 12, sm: 6, md: 4 }}
                    key={detail.label}
                  >
                    <Box>
                      <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={4}>
                        {detail.label}
                      </Text>
                      <Text
                        size="sm"
                        c={detail.value === 'N/A' ? 'dimmed' : undefined}
                      >
                        {detail.value}
                      </Text>
                    </Box>
                  </Grid.Col>
                ))}
              </Grid>

              <Divider />

              <Stack gap={4}>
                <Title order={5}>Monthly Contributions</Title>
                <Text size="sm" c="dimmed">
                  Employee share of statutory remittances
                </Text>
              </Stack>

              <Grid gutter="md">
                {contributionDetails.map((detail) => (
                  <Grid.Col
                    span={{ base: 12, sm: 6, md: 3 }}
                    key={detail.label}
                  >
                    <Box>
                      <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={4}>
                        {detail.label}
                      </Text>
                      <Text
                        size="sm"
                        c={detail.value === 'N/A' ? 'dimmed' : undefined}
                      >
                        {detail.value}
                      </Text>
                    </Box>
                  </Grid.Col>
                ))}
              </Grid>
            </Stack>
          </ScrollArea>
        </Stack>
      </Card>
    </Stack>
  );
}
