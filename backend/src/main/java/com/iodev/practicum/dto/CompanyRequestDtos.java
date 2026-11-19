package com.iodev.practicum.dto;

import java.util.List;

public final class CompanyRequestDtos {

    private CompanyRequestDtos() {}

    /** Isang hiling ng student = isang department (at ang company nito). */
    public record RequestRow(
            Long departmentId, String status,
            Long companyId, String companyName, String address, String contactNumber, String location,
            boolean newCompany,
            String departmentName, Integer slots,
            String supervisorFullname, String supervisorPosition,
            String supervisorEmail, String supervisorContactNumber,
            Long studentId, String studentNumber, String firstname, String lastname,
            String middleInitial, String subjectCode,
            String declineReason, String reviewedAt,
            String source, String consentAt) {}

    /**
     * requests = hiling ng student (at lumang hiling mula sa link), isa bawat department.
     * linkRequests = bagong hiling mula sa company link, isa bawat company (kasama ang lahat ng department).
     * pendingCount = parehong uri na naghihintay.
     */
    public record RequestsResponse(Long semesterId, boolean accepting, long pendingCount,
                                   List<RequestRow> requests, List<LinkRequestView> linkRequests,
                                   List<NatureOption> natures) {}

    public record NatureOption(Long id, String name) {}

    // ---------------------------------------------------------------------
    // Hiling mula sa company link (public na form at review ng coordinator)
    // ---------------------------------------------------------------------

    /**
     * Isang department sa form. Kapag hasDepartments = false, ang departments[0] ang N/A (hindi pinapansin ang name).
     * id = null sa bago; sa review ng coordinator, id ng department na binabago.
     * moaStart at moaExpiration: sa review ng coordinator lang; hindi pinapansin sa public na form.
     */
    public record LinkDepartmentInput(
            Long id, String name, Integer slots,
            String supervisorFullname, String supervisorPosition,
            String supervisorContactNumber, String supervisorEmail,
            String moaStart, String moaExpiration) {}

    /** Ang buong form. Sa review ng coordinator, hindi pinapansin ang token, consent, supervisorPermission at website. */
    public record LinkRequestInput(
            String token,
            String companyName, Long natureId, String address, String location,
            String companyContactNumber, String description,
            String contactFullname, String contactPosition, String contactNumber, String contactEmail,
            String idType, String idNumber,
            Boolean hasDepartments, List<LinkDepartmentInput> departments,
            List<String> skills,
            Boolean consent, Boolean supervisorPermission, String website,
            /* Kailangan kapag "Other" ang nature */
            String natureOther) {}

    public record LinkMoaFile(Long id, String name, String contentType, long size) {}

    public record LinkDepartmentView(
            Long id, String name, boolean na, Integer slots,
            String supervisorFullname, String supervisorPosition,
            String supervisorContactNumber, String supervisorEmail,
            String moaStart, String moaExpiration, String status, String declineReason,
            List<LinkMoaFile> moaFiles) {}

    /** kind: "company" (puwedeng i-merge dito) o "request" (ibang hiling na naghihintay pa) */
    public record DuplicateView(Long id, String name, String kind) {}

    /** status: pending, approved, rejected, merged */
    public record LinkRequestView(
            Long companyId, String status, String reason, String submittedAt, String reviewedAt,
            String companyName, Long natureId, String nature, String address, String location,
            String contactNumber, String description,
            String supervisorName, String supervisorPosition, String supervisorContactNumber, String supervisorEmail,
            String idType, String idNumber,
            boolean hasDepartments, List<LinkDepartmentView> departments, List<String> skills,
            String consentAt, String privacyVersion, List<DuplicateView> duplicates,
            /* Paliwanag ng "Other" (para sa Edit); ang "nature" ay ang ipinapakita */
            String natureOther) {}

    public record RejectRequest(String reason) {}

    public record PendingCount(long count) {}

    public record SettingsRequest(Boolean accepting) {}

    public record SettingsResult(boolean accepting) {}

    public record DeclineRequest(String reason) {}

    public record ReviewResult(String status) {}
}
