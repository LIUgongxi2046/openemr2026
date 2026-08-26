package org.openemr2026.appointment;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import java.time.LocalDate;
import org.openemr2026.contracts.AppointmentBookRequestWire;
import org.openemr2026.contracts.AppointmentCancelRequestWire;
import org.openemr2026.contracts.AppointmentCheckInRequestWire;
import org.openemr2026.contracts.AppointmentConsultRequestWire;
import org.openemr2026.contracts.AppointmentWire;
import org.openemr2026.contracts.ScheduleSlotCreateRequestWire;
import org.openemr2026.contracts.ScheduleSlotWire;
import org.openemr2026.contracts.WaitingQueueCallRequestWire;
import org.openemr2026.contracts.WaitingQueueEntryWire;
import org.openemr2026.security.ClinicalCommandSecurity;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
final class AppointmentController {
    private final ClinicalCommandSecurity security;
    private final AppointmentService appointments;

    AppointmentController(ClinicalCommandSecurity security, AppointmentService appointments) {
        this.security = security;
        this.appointments = appointments;
    }

    @PostMapping("/schedule-slots")
    ResponseEntity<ScheduleSlotWire> createSlot(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody ScheduleSlotCreateRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), null, null);
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(appointments.createScheduleSlot(identity, idempotencyKey, command));
    }

    @GetMapping("/schedule-slots")
    ResponseEntity<List<ScheduleSlotWire>> listSlots(
            HttpServletRequest request,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId,
            @RequestParam(value = "from_date", required = false) LocalDate fromDate,
            @RequestParam(value = "department_id", required = false) UUID departmentId,
            @RequestParam(value = "doctor_user_id", required = false) UUID doctorUserId) {
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(appointments.listScheduleSlots(
                        identity, facilityId, fromDate == null ? LocalDate.now() : fromDate,
                        departmentId, doctorUserId));
    }

    @GetMapping("/appointments")
    ResponseEntity<List<AppointmentWire>> list(
            HttpServletRequest request,
            @RequestParam("patient_id") UUID patientId,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId,
            @RequestHeader("X-Patient-Context") UUID patientContextId) {
        if (!patientId.equals(patientContextId)) throw AppointmentService.contextDenied();
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, patientId, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(appointments.listAppointments(identity, organizationId, facilityId, patientId));
    }

    @PostMapping("/appointments")
    ResponseEntity<AppointmentWire> book(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody AppointmentBookRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), command.patientId(), null);
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(appointments.bookAppointment(identity, idempotencyKey, command));
    }

    @PostMapping("/appointments/{appointment_id}/cancellations")
    ResponseEntity<AppointmentWire> cancel(
            HttpServletRequest request,
            @PathVariable("appointment_id") UUID appointmentId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody AppointmentCancelRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), command.patientId(), null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(appointments.cancelAppointment(identity, idempotencyKey, appointmentId, command));
    }

    @PostMapping("/appointments/{appointment_id}/check-ins")
    ResponseEntity<WaitingQueueEntryWire> checkIn(
            HttpServletRequest request,
            @PathVariable("appointment_id") UUID appointmentId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody AppointmentCheckInRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), command.patientId(), null);
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(appointments.checkIn(identity, idempotencyKey, appointmentId, command));
    }

    @PostMapping("/appointments/{appointment_id}/consults")
    ResponseEntity<AppointmentWire> consult(
            HttpServletRequest request,
            @PathVariable("appointment_id") UUID appointmentId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody AppointmentConsultRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), command.patientId(), null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(appointments.consult(identity, idempotencyKey, appointmentId, command));
    }

    @GetMapping("/waiting-queue")
    ResponseEntity<List<WaitingQueueEntryWire>> listQueue(
            HttpServletRequest request,
            @RequestParam("facility_id") UUID facilityId,
            @RequestParam("date") LocalDate date,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityContextId) {
        if (!facilityId.equals(facilityContextId)) throw AppointmentService.contextDenied();
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(appointments.listWaitingQueue(identity, facilityId, date));
    }

    @PostMapping("/waiting-queue/{waiting_queue_entry_id}/calls")
    ResponseEntity<WaitingQueueEntryWire> call(
            HttpServletRequest request,
            @PathVariable("waiting_queue_entry_id") UUID entryId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody WaitingQueueCallRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(appointments.callWaitingQueue(identity, idempotencyKey, entryId, command));
    }
}
