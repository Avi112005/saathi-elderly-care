"use client";

import { useActionState, useEffect, useRef } from "react";
import { addQuestion, recordOutcome, saveAppointment } from "@/app/actions/appointments";
import { IDLE } from "@/lib/actions";
import { FormMessage, SelectField, SubmitButton, TextArea, TextField } from "@/components/ui/form";

export interface AppointmentFormValues {
  id?: string;
  title: string;
  doctorName: string;
  specialty: string;
  location: string;
  date: string;
  time: string;
  durationMin: number;
  notes: string;
  questions: string;
  transport: string;
}

export function AppointmentForm({ initial }: { initial: AppointmentFormValues }) {
  const [state, action] = useActionState(saveAppointment, IDLE);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <TextField label="What is the visit for?" name="title" defaultValue={initial.title} placeholder="Cardiology follow-up" required errors={e.title} maxLength={100} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Doctor" name="doctorName" defaultValue={initial.doctorName} placeholder="Dr. Anil Mehta" errors={e.doctorName} maxLength={80} />
        <TextField label="Speciality" name="specialty" defaultValue={initial.specialty} placeholder="Cardiology" errors={e.specialty} maxLength={60} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Date" name="date" type="date" defaultValue={initial.date} required errors={e.date} />
        <TextField label="Time" name="time" type="time" defaultValue={initial.time} required errors={e.time} />
        <SelectField
          label="Length"
          name="durationMin"
          defaultValue={String(initial.durationMin)}
          options={[15, 30, 45, 60, 90, 120, 240].map((m) => ({ value: String(m), label: m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}` }))}
          errors={e.durationMin}
        />
      </div>
      <TextField label="Where" name="location" defaultValue={initial.location} placeholder="Clinic name, floor, address" errors={e.location} maxLength={160} />
      <TextField label="Getting there" name="transport" defaultValue={initial.transport} placeholder="Rahul will drive — leave by 10:15" hint="Included in the reminder emails so everyone knows the plan." errors={e.transport} maxLength={160} />
      <TextArea label="Questions for the doctor" name="questions" defaultValue={initial.questions} placeholder={"One per line, e.g.\nCan the sleeping tablet be reduced?"} hint="The elder can add to this list any time before the visit." errors={e.questions} rows={4} maxLength={1500} />
      <TextArea label="Things to bring / notes" name="notes" defaultValue={initial.notes} placeholder="Last ECG, fasting from 10 PM" errors={e.notes} maxLength={1000} />
      <FormMessage state={state} />
      <div>
        <SubmitButton size="lg" icon="check">
          {initial.id ? "Save changes" : "Add appointment"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function QuestionForm({ id }: { id: string }) {
  const [state, action] = useActionState(addQuestion, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-end gap-2">
        <TextField label="Add a question" name="question" placeholder="Is my blood sugar okay?" className="flex-1" maxLength={200} required />
        <SubmitButton icon="plus" pendingLabel="Adding…">
          Add
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function OutcomeForm({ id, status, outcome }: { id: string; status: string; outcome: string }) {
  const [state, action] = useActionState(recordOutcome, IDLE);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <SelectField
        label="Status"
        name="status"
        defaultValue={status}
        options={[
          { value: "SCHEDULED", label: "Scheduled" },
          { value: "COMPLETED", label: "Completed" },
          { value: "CANCELLED", label: "Cancelled" },
        ]}
      />
      <TextArea label="What the doctor said" name="outcome" defaultValue={outcome} placeholder="New prescriptions, test results, next visit…" rows={4} maxLength={2000} />
      <FormMessage state={state} />
      <div>
        <SubmitButton variant="secondary" icon="check">
          Save visit notes
        </SubmitButton>
      </div>
    </form>
  );
}
