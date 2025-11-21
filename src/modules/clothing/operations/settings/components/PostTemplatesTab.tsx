'use client';

import { useState, useEffect } from 'react';
import {
  Paper,
  Stack,
  Title,
  Text,
  Textarea,
  Button,
  Group,
  Alert,
} from '@mantine/core';
import { IconInfoCircle, IconCheck, IconX } from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import Swal from 'sweetalert2';
import { DEFAULT_POST_TEMPLATE_NOTICE } from '@/modules/clothing/operations/post-template/notice.data';
import type { PostTemplateNotice } from '@/modules/clothing/operations/post-template/notice.types';
import { logger } from '@/lib/logger';

const serializeNotice = (notice: PostTemplateNotice) => ({
  paragraphs: notice.introParagraphs.join('\n\n'),
  bullets: notice.bulletPoints.join('\n'),
});

const parseParagraphs = (value: string) =>
  value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

const parseBullets = (value: string) =>
  value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

export function PostTemplatesTab() {
  const [loading, setLoading] = useState(true);
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [noticeValues, setNoticeValues] = useState(() =>
    serializeNotice(DEFAULT_POST_TEMPLATE_NOTICE)
  );
  const [snapshot, setSnapshot] = useState(() =>
    serializeNotice(DEFAULT_POST_TEMPLATE_NOTICE)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNotice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchNotice = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/post-template-notice');
      if (!response.ok) {
        throw new Error('Failed to load post template notice');
      }

      const result = await response.json();
      const notice = (result.data ||
        DEFAULT_POST_TEMPLATE_NOTICE) as PostTemplateNotice;

      const serialized = serializeNotice(notice);
      setNoticeValues(serialized);
      setSnapshot(serialized);
      setEditingEnabled(false);
    } catch (error) {
      logger.error('Error fetching post template notice', error);
      showNotification({
        title: 'Error',
        message: 'Failed to load notice. Showing default copy.',
        color: 'red',
        icon: <IconX size={16} />,
      });
      const fallback = serializeNotice(DEFAULT_POST_TEMPLATE_NOTICE);
      setNoticeValues(fallback);
      setSnapshot(fallback);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges =
    noticeValues.paragraphs.trim() !== snapshot.paragraphs.trim() ||
    noticeValues.bullets.trim() !== snapshot.bullets.trim();

  const handleEnableEditing = async () => {
    const confirmation = await Swal.fire({
      title: 'Edit post template notice?',
      text: 'This updates the shared copy on the Post Template module.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Enable editing',
      cancelButtonText: 'Cancel',
      focusCancel: true,
    });

    if (confirmation.isConfirmed) {
      setEditingEnabled(true);
    }
  };

  const handleCancelEditing = () => {
    setNoticeValues(snapshot);
    setEditingEnabled(false);
  };

  const handleSave = async () => {
    const introParagraphs = parseParagraphs(noticeValues.paragraphs);
    const bulletPoints = parseBullets(noticeValues.bullets);

    if (introParagraphs.length === 0) {
      showNotification({
        title: 'Validation error',
        message: 'Add at least one intro paragraph.',
        color: 'red',
        icon: <IconX size={16} />,
      });
      return;
    }

    if (bulletPoints.length === 0) {
      showNotification({
        title: 'Validation error',
        message: 'Add at least one bullet point.',
        color: 'red',
        icon: <IconX size={16} />,
      });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/post-template-notice', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ introParagraphs, bulletPoints }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to save notice');
      }

      const result = await response.json();
      const updated = serializeNotice(result.data as PostTemplateNotice);
      setSnapshot(updated);
      setNoticeValues(updated);
      setEditingEnabled(false);

      showNotification({
        title: 'Notice saved',
        message: 'Post Template notice updated successfully.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      logger.error('Error saving post template notice', error);
      showNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to save notice',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper p="md">
      <Stack gap="md">
        <div>
          <Title order={4}>Post Template Notice</Title>
          <Text size="sm" c="dimmed">
            Update the fine-print block that appears on the Post Template module
            and gets copied to the clipboard.
          </Text>
        </div>

        <Alert icon={<IconInfoCircle size={16} />} color="blue">
          Keep each paragraph focused on a single idea. Separate paragraphs with
          a blank line and add one bullet per line for the required buyer
          details.
        </Alert>

        <Textarea
          label="Intro paragraphs"
          description="Separate each paragraph with a blank line"
          autosize
          minRows={12}
          value={noticeValues.paragraphs}
          onChange={(event) => {
            const { value } = event.currentTarget;
            setNoticeValues((prev) => ({
              ...prev,
              paragraphs: value,
            }));
          }}
          readOnly={!editingEnabled}
          styles={{
            input: !editingEnabled
              ? { backgroundColor: '#f8fafc', cursor: 'not-allowed' }
              : undefined,
          }}
        />

        <Textarea
          label="Bullet points"
          description="One bullet per line"
          autosize
          minRows={6}
          value={noticeValues.bullets}
          onChange={(event) => {
            const { value } = event.currentTarget;
            setNoticeValues((prev) => ({
              ...prev,
              bullets: value,
            }));
          }}
          readOnly={!editingEnabled}
          styles={{
            input: !editingEnabled
              ? { backgroundColor: '#f8fafc', cursor: 'not-allowed' }
              : undefined,
          }}
        />

        <Group justify="flex-end">
          <Button
            variant="light"
            onClick={handleEnableEditing}
            disabled={editingEnabled || loading}
          >
            Edit Notice
          </Button>
          <Button
            variant="default"
            onClick={handleCancelEditing}
            disabled={!editingEnabled}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!editingEnabled || !hasChanges}
            loading={saving}
          >
            Save Notice
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
