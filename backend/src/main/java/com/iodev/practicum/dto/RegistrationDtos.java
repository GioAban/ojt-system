package com.iodev.practicum.dto;

import java.util.List;

/** Pagpaparehistro ng student gamit ang link, at ang pag-verify ng coordinator */
public final class RegistrationDtos {

    private RegistrationDtos() {}

    /** Galing sa public na form. website = honeypot (dapat walang laman) */
    public record RegisterRequest(
            String token,
            String studentNumber,
            String lastname,
            String firstname,
            String middleInitial,
            String year,
            String gender,
            String email,
            String password,
            String confirmPassword,
            Boolean privacyAccepted,
            String website) {}

    /** Isang row sa Pending registrations tab */
    public record RegistrationRow(
            Long id,
            String studentNumber,
            String lastname,
            String firstname,
            String middleInitial,
            String year,
            String gender,
            String course,
            String email,
            String status,
            String rejectReason,
            String createdAt,
            String decidedAt,
            /* Na-verify ng student ang email (false sa mga registration bago nagkaroon ng email) */
            boolean emailVerified,
            /* Kailan huling naipadala ang verification link; null = wala */
            String linkSentAt,
            /* Ang Student na nagawa (para sa Revoke) */
            Long studentId) {}

    /** Pagwawasto ng coordinator bago i-verify; null = huwag galawin. Ang email ay sa hindi pa verified lang. */
    public record RegistrationEdit(
            String studentNumber,
            String lastname,
            String firstname,
            String middleInitial,
            String year,
            String gender,
            String course,
            String email) {}

    /** Sagot ng "Resend link" ng coordinator */
    public record ResendResult(boolean sent, String message) {}

    public record RejectRequest(String reason) {}

    public record BulkIds(List<Long> ids) {}

    /** done = nagawa, skipped = nilaktawan, problems = maikling dahilan bawat nilaktawan */
    public record BulkResult(int done, int skipped, List<String> problems) {}

    /** Mga field na kinukumpleto ng student pagkatapos ma-verify */
    public record CompleteProfileRequest(
            String contact,
            String birthday,
            String address,
            String parent,
            String guardian) {}
}
