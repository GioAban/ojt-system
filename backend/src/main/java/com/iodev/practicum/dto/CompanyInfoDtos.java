package com.iodev.practicum.dto;

import java.util.List;

public final class CompanyInfoDtos {

    private CompanyInfoDtos() {}

    public record CompanyInfoRow(
            Long id, String studentNumber, String firstname, String lastname, String middleInitial,
            String subjectCode, Long companyId, String companyName, Long departmentId, String departmentName,
            String address, String contactNumber, String location,
            String supervisorName, String supervisorPosition, String startDate) {}

    public record CompanyInfoResponse(Long semesterId, List<CompanyInfoRow> students) {}

    /** Para sa company at department: field + value. Para sa student: value lang. */
    public record CompanyInfoEdit(String field, String value) {}

    public record CompanyInfoEditResult(String value, long affected) {}
}