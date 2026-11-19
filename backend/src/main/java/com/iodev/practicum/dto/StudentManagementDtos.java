package com.iodev.practicum.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public class StudentManagementDtos {

    /** Isang row sa listahan ng Students page */
    public record StudentRow(
            Long id,
            String studentNumber,
            String lastname,
            String firstname,
            String middleInitial,
            String gender,
            String year,
            String contact,
            String email,
            String birthday,
            String address,
            String subjectCode,
            String status,
            boolean archived,
            String companyName,
            String departmentName,
            boolean registered) {}

    public record StudentListResponse(
            Long semesterId,
            String programName,
            String programAbbreviation,
            List<StudentRow> students) {}

    public record StudentCreateRequest(
            Long semesterId,
            String studentNumber,
            String lastname,
            String firstname,
            String middleInitial,
            String gender,
            String year,
            String course) {}

    /** Inline edit ng isang field */
    public record StudentEdit(String field, String value) {}

    public record SetPasswordRequest(String password) {}

    /** Laman ng side drawer */
    public record StudentDetail(
            StudentRow student,
            String parent,
            String guardian,
            String moaStatus,
            String deployedDate,
            String startTrainingDate,
            String completedDate,
            BigDecimal renderedHours,
            BigDecimal trainingDuration,
            String companyAddress,
            String supervisorName,
            String supervisorPosition,
            String employabilityLevel,
            Map<String, Long> requirements) {}

    // ---------------------------------------------------------------------
    // Registration link
    // ---------------------------------------------------------------------

    /** dueDate = yyyy-MM-dd (huling araw na bukas ang link). Bilang ng registration bawat status. */
    public record EnrollmentLinkState(
            boolean exists,
            String token,
            boolean open,
            String dueDate,
            boolean active,
            long pending,
            long verified,
            long rejected,
            long total,
            /* "Also require my approval" */
            boolean requireApproval,
            /* Hindi pa na-verify ang email */
            long awaitingEmail,
            long revoked) {}

    /** requireApproval: null = huwag baguhin */
    public record EnrollmentLinkRequest(Long semesterId, String dueDate, Boolean open, Boolean requireApproval) {}

    /** Resulta ng pag-accept/reset; ang temporaryPassword ay ang default password (ID + initials) */
    public record ApprovalResult(
            Long studentId,
            String name,
            String email,
            String temporaryPassword) {}

    public record CreateAccountRequest(String email) {}

    public record ChangePasswordRequest(String currentPassword, String newPassword) {}
}
