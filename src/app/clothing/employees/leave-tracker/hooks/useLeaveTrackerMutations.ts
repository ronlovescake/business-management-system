import { useMutation, type QueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import type { LeaveRequest, LeaveStatus } from '../types';

type LeaveTrackerMutationsArgs = {
  queryClient: QueryClient;
  resolveApiPath: (path: string) => string;
  leaveRequestsQueryKey: readonly unknown[];
  leaveRequests: LeaveRequest[];
};

export function useLeaveTrackerMutations({
  queryClient,
  resolveApiPath,
  leaveRequestsQueryKey,
  leaveRequests,
}: LeaveTrackerMutationsArgs) {
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${resolveApiPath('/leave-requests')}/${id}`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: leaveRequestsQueryKey });
      const previousLeaveRequests = queryClient.getQueryData<LeaveRequest[]>(
        leaveRequestsQueryKey
      );
      queryClient.setQueryData<LeaveRequest[]>(leaveRequestsQueryKey, (old) =>
        old ? old.filter((req) => req.id !== id) : []
      );
      return { previousLeaveRequests };
    },
    onError: (err, _id, context) => {
      if (context?.previousLeaveRequests) {
        queryClient.setQueryData(
          leaveRequestsQueryKey,
          context.previousLeaveRequests
        );
      }
      logger.error('Error deleting leave request:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to delete leave request: ${errorMessage}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: leaveRequestsQueryKey });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (
      payload:
        | Omit<LeaveRequest, 'id'>
        | Omit<LeaveRequest, 'id'>[]
        | (Omit<LeaveRequest, 'id'> & { id?: string })
    ) => {
      return api.post(resolveApiPath('/leave-requests'), payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveRequestsQueryKey });
    },
    onError: (err) => {
      logger.error('Error saving leave request:', err);
      alert('Failed to save leave request. Please try again.');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(resolveApiPath('/leave-requests'), {
        id,
        status: 'approved',
        approvedBy: 'System Admin',
      });
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: leaveRequestsQueryKey });
      const previousLeaveRequests = queryClient.getQueryData<LeaveRequest[]>(
        leaveRequestsQueryKey
      );
      queryClient.setQueryData<LeaveRequest[]>(leaveRequestsQueryKey, (old) =>
        old
          ? old.map((req) =>
              req.id === id
                ? {
                    ...req,
                    status: 'approved' as LeaveStatus,
                    approvedBy: 'System Admin',
                  }
                : req
            )
          : []
      );
      return { previousLeaveRequests };
    },
    onSuccess: async (id) => {
      const targetRequest = leaveRequests.find((request) => request.id === id);
      if (
        targetRequest?.employeeId &&
        targetRequest.startDate &&
        targetRequest.endDate
      ) {
        try {
          await api.post(resolveApiPath('/attendance/apply-leave'), {
            employeeId: targetRequest.employeeId,
            employeeName: targetRequest.employeeName,
            leaveType: targetRequest.leaveType,
            startDate: targetRequest.startDate,
            endDate: targetRequest.endDate,
          });
        } catch (attendanceError) {
          logger.error(
            'Error synchronising attendance for approved leave:',
            attendanceError
          );
        }
      }
    },
    onError: (err, _id, context) => {
      if (context?.previousLeaveRequests) {
        queryClient.setQueryData(
          leaveRequestsQueryKey,
          context.previousLeaveRequests
        );
      }
      logger.error('Error approving leave request:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to approve leave request: ${errorMessage}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: leaveRequestsQueryKey });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(resolveApiPath('/leave-requests'), {
        id,
        status: 'rejected',
      });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: leaveRequestsQueryKey });
      const previousLeaveRequests = queryClient.getQueryData<LeaveRequest[]>(
        leaveRequestsQueryKey
      );
      queryClient.setQueryData<LeaveRequest[]>(leaveRequestsQueryKey, (old) =>
        old
          ? old.map((req) =>
              req.id === id
                ? { ...req, status: 'rejected' as LeaveStatus }
                : req
            )
          : []
      );
      return { previousLeaveRequests };
    },
    onError: (err, _id, context) => {
      if (context?.previousLeaveRequests) {
        queryClient.setQueryData(
          leaveRequestsQueryKey,
          context.previousLeaveRequests
        );
      }
      logger.error('Error rejecting leave request:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to reject leave request: ${errorMessage}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: leaveRequestsQueryKey });
    },
  });

  return {
    deleteMutation,
    saveMutation,
    approveMutation,
    rejectMutation,
  };
}
