import {
  Box,
  Card,
  Divider,
  Grid,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import type { EmployeeDetailField } from '../../types/detail-field';

interface ProfileOverviewTabProps {
  categories: string[];
  details: EmployeeDetailField[];
}

export function ProfileOverviewTab({
  categories,
  details,
}: ProfileOverviewTabProps) {
  return (
    <Stack gap="lg">
      {categories.map((category) => {
        const categoryDetails = details.filter(
          (detail) => detail.category === category
        );

        return (
          <Card key={category} withBorder padding={0}>
            <Paper p="md" bg="gray.0">
              <Title order={4}>{category}</Title>
            </Paper>
            <Divider />
            <Box p="lg">
              <Grid gutter="md">
                {categoryDetails.map((detail) => (
                  <Grid.Col
                    span={{ base: 12, sm: 6, md: 4 }}
                    key={`${category}-${detail.label}`}
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
            </Box>
          </Card>
        );
      })}
    </Stack>
  );
}
