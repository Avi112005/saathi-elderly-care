"use client";

import { useActionState } from "react";
import { changePin, deleteCircle, updateMySettings, updateProfile } from "@/app/actions/settings";
import { IDLE } from "@/lib/actions";
import { Checkbox, FormMessage, SelectField, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import { TimezoneSelect } from "@/components/auth/timezone-select";

export interface MySettings {
  name: string;
  relationship: string;
  email: string;
  emailDoseReminders: boolean;
  emailMissedDoses: boolean;
  emailAppointments: boolean;
  emailRefills: boolean;
  emailDailyDigest: boolean;
  emailVitalAlerts: boolean;
  quietStart: string;
  quietEnd: string;
}

export function MySettingsForm({ initial }: { initial: MySettings }) {
  const [state, action] = useActionState(updateMySettings, IDLE);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Name"
          name="name"
          defaultValue={initial.name}
          required
          errors={e.name}
          maxLength={60}
          autoComplete="name"
        />
        <TextField
          label="Relationship"
          name="relationship"
          defaultValue={initial.relationship}
          errors={e.relationship}
          maxLength={40}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          defaultValue={initial.email}
          errors={e.email}
          autoComplete="email"
        />
      </div>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 text-sm font-semibold">Email me about</legend>
        <Checkbox
          name="emailDoseReminders"
          defaultChecked={initial.emailDoseReminders}
          label="Upcoming doses"
          description="A few minutes before each dose time."
        />
        <Checkbox
          name="emailMissedDoses"
          defaultChecked={initial.emailMissedDoses}
          label="Unconfirmed and missed doses"
          description="Nudges after 30 minutes (elder & caretakers); missed alerts after 2 hours (everyone)."
        />
        <Checkbox
          name="emailAppointments"
          defaultChecked={initial.emailAppointments}
          label="Appointments"
          description="The day before and 2 hours before."
        />
        <Checkbox
          name="emailRefills"
          defaultChecked={initial.emailRefills}
          label="Refills"
          description="When a medicine is about to run out (weekly at most)."
        />
        <Checkbox
          name="emailVitalAlerts"
          defaultChecked={initial.emailVitalAlerts}
          label="Worrying health readings"
          description="Urgent readings go to everyone; high or low ones to the elder and caretakers."
        />
        <Checkbox
          name="emailDailyDigest"
          defaultChecked={initial.emailDailyDigest}
          label="Evening summary"
          description="One email at 8 PM with the day's doses and tomorrow's plans."
        />
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">Quiet hours</legend>
        <p className="text-sm text-ink-2">
          Reminders that can wait (upcoming doses, refills, summaries) are held. Missed-dose alerts still come through.
        </p>
        <div className="mt-3 grid max-w-md grid-cols-2 gap-4">
          <TextField
            label="From"
            name="quietStart"
            type="time"
            defaultValue={initial.quietStart}
            errors={e.quietStart}
          />
          <TextField label="Until" name="quietEnd" type="time" defaultValue={initial.quietEnd} errors={e.quietEnd} />
        </div>
      </fieldset>
      <FormMessage state={state} />
      <div>
        <SubmitButton icon="check">Save my settings</SubmitButton>
      </div>
    </form>
  );
}

export function ChangePinForm() {
  const [state, action] = useActionState(changePin, IDLE);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Current PIN"
          name="currentPin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={8}
          required
          errors={e.currentPin}
        />
        <TextField
          label="New PIN"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={8}
          required
          errors={e.pin}
          hint="6–8 digits"
        />
        <TextField
          label="New PIN again"
          name="confirmPin"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={8}
          required
          errors={e.confirmPin}
        />
      </div>
      <FormMessage state={state} />
      <div>
        <SubmitButton variant="secondary" icon="key">
          Change PIN
        </SubmitButton>
      </div>
    </form>
  );
}

export interface ProfileValues {
  fullName: string;
  preferredName: string;
  dateOfBirth: string;
  timezone: string;
  conditions: string;
  allergies: string;
  bloodGroup: string;
  emergencyContact: string;
  primaryDoctor: string;
  notes: string;
  reminderLeadMin: number;
  nudgeAfterMin: number;
  escalateAfterMin: number;
}

export function ProfileForm({ initial, zones }: { initial: ProfileValues; zones: string[] }) {
  const [state, action] = useActionState(updateProfile, IDLE);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Full name"
          name="fullName"
          defaultValue={initial.fullName}
          required
          errors={e.fullName}
          maxLength={80}
        />
        <TextField
          label="Preferred name"
          name="preferredName"
          defaultValue={initial.preferredName}
          required
          errors={e.preferredName}
          maxLength={40}
        />
        <TextField
          label="Date of birth"
          name="dateOfBirth"
          type="date"
          defaultValue={initial.dateOfBirth}
          errors={e.dateOfBirth}
        />
        <TimezoneSelect zones={zones} defaultValue={initial.timezone} errors={e.timezone} />
        <SelectField
          label="Blood group"
          name="bloodGroup"
          defaultValue={initial.bloodGroup}
          options={[
            { value: "", label: "Not known" },
            ...["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => ({ value: b, label: b })),
          ]}
          errors={e.bloodGroup}
        />
        <TextField
          label="Emergency contact"
          name="emergencyContact"
          defaultValue={initial.emergencyContact}
          placeholder="Name · phone"
          errors={e.emergencyContact}
          maxLength={160}
        />
      </div>
      <TextField
        label="Primary doctor"
        name="primaryDoctor"
        defaultValue={initial.primaryDoctor}
        errors={e.primaryDoctor}
        maxLength={160}
      />
      <TextArea
        label="Conditions"
        name="conditions"
        defaultValue={initial.conditions}
        errors={e.conditions}
        maxLength={500}
      />
      <TextField
        label="Allergies"
        name="allergies"
        defaultValue={initial.allergies}
        errors={e.allergies}
        maxLength={300}
        hint="Checked against every medicine."
      />
      <TextArea
        label="Notes for carers"
        name="notes"
        defaultValue={initial.notes}
        errors={e.notes}
        maxLength={1000}
        placeholder="Uses a walking stick, prefers Hindi on calls…"
      />

      <fieldset className="rounded-2xl border border-line bg-paper p-4">
        <legend className="px-1 font-serif text-xl">Escalation ladder</legend>
        <p className="text-sm text-ink-2">Tune how quickly the circle hears about an unconfirmed dose.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <TextField
            label="Remind … min before"
            name="reminderLeadMin"
            type="number"
            min={0}
            max={120}
            defaultValue={initial.reminderLeadMin}
            errors={e.reminderLeadMin}
          />
          <TextField
            label="Nudge … min after"
            name="nudgeAfterMin"
            type="number"
            min={5}
            max={600}
            defaultValue={initial.nudgeAfterMin}
            errors={e.nudgeAfterMin}
          />
          <TextField
            label="Mark missed … min after"
            name="escalateAfterMin"
            type="number"
            min={10}
            max={720}
            defaultValue={initial.escalateAfterMin}
            errors={e.escalateAfterMin}
          />
        </div>
      </fieldset>
      <FormMessage state={state} />
      <div>
        <SubmitButton icon="check">Save health profile</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteCircleForm({ name }: { name: string }) {
  const [state, action] = useActionState(deleteCircle, IDLE);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <TextField
        label={`Type "${name}" to confirm`}
        name="confirm"
        autoComplete="off"
        errors={state.fieldErrors?.confirm}
      />
      <FormMessage state={state} />
      <div>
        <SubmitButton variant="danger" pendingLabel="Deleting…">
          Permanently delete this care circle
        </SubmitButton>
      </div>
    </form>
  );
}
