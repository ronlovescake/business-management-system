/**
 * Example: Multi-Step Wizard Dialog
 *
 * Shows how to create a multi-step wizard/form using the Dialog component.
 */

import { useState } from 'react';
import { Stack, TextInput, Stepper } from '@mantine/core';
import { IconUser, IconCheck } from '@tabler/icons-react';
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from '@/components/shared/Dialog';

interface FormData {
  name: string;
  email: string;
  company: string;
  phone: string;
}

interface WizardDialogProps {
  opened: boolean;
  onClose: () => void;
  onComplete: (data: FormData) => void;
}

export function WizardDialog({
  opened,
  onClose,
  onComplete,
}: WizardDialogProps) {
  const [active, setActive] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
  });

  const nextStep = () =>
    setActive((current) => (current < 2 ? current + 1 : current));
  const prevStep = () =>
    setActive((current) => (current > 0 ? current - 1 : current));

  const handleComplete = () => {
    onComplete(formData);
    onClose();
    setActive(0);
    setFormData({ name: '', email: '', company: '', phone: '' });
  };

  const handleClose = () => {
    onClose();
    setActive(0);
  };

  return (
    <Dialog opened={opened} onClose={handleClose} size="lg">
      <DialogHeader
        title="Setup Wizard"
        subtitle={`Step ${active + 1} of 3`}
        icon={<IconUser size={24} />}
        iconColor="blue"
      />

      <DialogBody maxHeight="60vh">
        <Stepper active={active} onStepClick={setActive} mb="xl">
          <Stepper.Step label="Personal Info" description="Basic details">
            <Stack gap="md">
              <TextInput
                label="Full Name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
              <TextInput
                label="Email"
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="Company Info" description="Business details">
            <Stack gap="md">
              <TextInput
                label="Company Name"
                value={formData.company}
                onChange={(e) =>
                  setFormData({ ...formData, company: e.target.value })
                }
              />
              <TextInput
                label="Phone Number"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="Review" description="Confirm details">
            <Stack gap="sm">
              <div>
                <strong>Name:</strong> {formData.name}
              </div>
              <div>
                <strong>Email:</strong> {formData.email}
              </div>
              <div>
                <strong>Company:</strong> {formData.company || 'N/A'}
              </div>
              <div>
                <strong>Phone:</strong> {formData.phone || 'N/A'}
              </div>
            </Stack>
          </Stepper.Step>

          <Stepper.Completed>
            <Stack align="center" gap="md">
              <IconCheck size={64} color="green" />
              <div>All set! Click Complete to finish.</div>
            </Stack>
          </Stepper.Completed>
        </Stepper>
      </DialogBody>

      <DialogFooter
        layout="space-between"
        additionalButtons={
          active > 0
            ? [
                {
                  label: 'Back',
                  onClick: prevStep,
                  variant: 'light',
                },
              ]
            : []
        }
        secondaryButton={{
          label: 'Cancel',
          onClick: handleClose,
          variant: 'default',
        }}
        primaryButton={
          active === 2
            ? {
                label: 'Complete',
                onClick: handleComplete,
                color: 'green',
              }
            : {
                label: 'Next',
                onClick: nextStep,
                disabled: active === 0 && (!formData.name || !formData.email),
              }
        }
      />
    </Dialog>
  );
}

// Usage:
/*
function MyComponent() {
  const [wizardOpen, setWizardOpen] = useState(false);

  const handleComplete = (data) => {
    console.log('Wizard completed with data:', data);
    // Save data...
  };

  return (
    <>
      <Button onClick={() => setWizardOpen(true)}>Start Wizard</Button>
      
      <WizardDialog
        opened={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={handleComplete}
      />
    </>
  );
}
*/
