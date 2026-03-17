import { useCallback, useState } from 'react';
import type { LeaveRequest, LeaveType } from '../types';

type LeaveTrackerFormValues = {
  formEmployeeName: string;
  formEmployeeId: string;
  formLeaveType: LeaveType | '';
  formPaymentStatus: string;
  formStartDate: string;
  formEndDate: string;
  formReason: string;
  formNotes: string;
};

const buildEmptyFormValues = (): LeaveTrackerFormValues => ({
  formEmployeeName: '',
  formEmployeeId: '',
  formLeaveType: '',
  formPaymentStatus: '',
  formStartDate: '',
  formEndDate: '',
  formReason: '',
  formNotes: '',
});

const buildRequestFormValues = (
  request: LeaveRequest
): LeaveTrackerFormValues => ({
  formEmployeeName: request.employeeName,
  formEmployeeId: request.employeeId,
  formLeaveType: request.leaveType,
  formPaymentStatus: request.paymentStatus,
  formStartDate: request.startDate,
  formEndDate: request.endDate,
  formReason: request.reason,
  formNotes: request.notes || '',
});

export function useLeaveTrackerFormState() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<string | null>('list');

  const [formEmployeeName, setFormEmployeeName] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formLeaveType, setFormLeaveType] = useState<LeaveType | ''>('');
  const [formPaymentStatus, setFormPaymentStatus] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const applyFormValues = useCallback((values: LeaveTrackerFormValues) => {
    setFormEmployeeName(values.formEmployeeName);
    setFormEmployeeId(values.formEmployeeId);
    setFormLeaveType(values.formLeaveType);
    setFormPaymentStatus(values.formPaymentStatus);
    setFormStartDate(values.formStartDate);
    setFormEndDate(values.formEndDate);
    setFormReason(values.formReason);
    setFormNotes(values.formNotes);
  }, []);

  const resetFormFields = useCallback(() => {
    applyFormValues(buildEmptyFormValues());
    setEditingRequest(null);
  }, [applyFormValues]);

  const populateFormFromRequest = useCallback(
    (request: LeaveRequest) => {
      setEditingRequest(request);
      applyFormValues(buildRequestFormValues(request));
    },
    [applyFormValues]
  );

  return {
    isModalOpen,
    setIsModalOpen,
    editingRequest,
    setEditingRequest,
    activeTab,
    setActiveTab,
    formEmployeeName,
    setFormEmployeeName,
    formEmployeeId,
    setFormEmployeeId,
    formLeaveType,
    setFormLeaveType,
    formPaymentStatus,
    setFormPaymentStatus,
    formStartDate,
    setFormStartDate,
    formEndDate,
    setFormEndDate,
    formReason,
    setFormReason,
    formNotes,
    setFormNotes,
    resetFormFields,
    populateFormFromRequest,
  };
}
