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
            String declineReason, String reviewedAt) {}

    public record RequestsResponse(Long semesterId, boolean accepting, long pendingCount,
                                   List<RequestRow> requests) {}

    public record PendingCount(long count) {}

    public record SettingsRequest(Boolean accepting) {}

    public record SettingsResult(boolean accepting) {}

    public record DeclineRequest(String reason) {}

    public record ReviewResult(String status) {}
}
