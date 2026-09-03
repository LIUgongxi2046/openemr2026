package org.openemr2026.device;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.DeviceObservationWire;
import org.openemr2026.contracts.DeviceStatusWire;
import org.openemr2026.contracts.DeviceTelemetryCollectRequestWire;
import org.openemr2026.contracts.DeviceTelemetryCollectResultWire;
import org.openemr2026.security.ClinicalCommandSecurity;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
final class DeviceTelemetryController {
    private final ClinicalCommandSecurity security;
    private final DeviceTelemetryService telemetry;

    DeviceTelemetryController(ClinicalCommandSecurity security, DeviceTelemetryService telemetry) {
        this.security = security;
        this.telemetry = telemetry;
    }

    @GetMapping("/device-telemetry")
    ResponseEntity<List<DeviceObservationWire>> list(
            HttpServletRequest request,
            @RequestParam(value = "device_code", required = false) String deviceCode,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId) {
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(telemetry.listObservations(identity, deviceCode));
    }

    @PostMapping("/device-telemetry")
    ResponseEntity<DeviceTelemetryCollectResultWire> collect(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody DeviceTelemetryCollectRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(telemetry.collect(identity, idempotencyKey, command));
    }

    @GetMapping("/device-statuses")
    ResponseEntity<List<DeviceStatusWire>> statuses(
            HttpServletRequest request,
            @RequestParam(value = "device_code", required = false) String deviceCode,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId) {
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(telemetry.listStatuses(identity, deviceCode));
    }
}
