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
    // Bulk import
    // ---------------------------------------------------------------------

    public record ImportRow(
            int line,
            String studentNumber,
            String lastname,
            String firstname,
            String middleInitial,
            String gender,
            String year,
            String course,
            List<String> errors) {}

    public record ImportPreview(int total, int valid, int invalid, List<ImportRow> rows) {}

    public record ImportCommitRequest(Long semesterId, List<ImportRow> rows) {}

    public record ImportRowError(int line, String message) {}

    public record ImportCommitResult(int created, int skipped, List<ImportRowError> errors) {}

    // ---------------------------------------------------------------------
    // Enrollment link
    // ---------------------------------------------------------------------

    /** dueDate = yyyy-MM-dd (huling araw na bukas ang link) */
    public record EnrollmentLinkState(
            boolean exists,
            String token,
            boolean open,
            String dueDate,
            boolean active,
            long registered,
            long total,
            long pending) {}

    public record EnrollmentLinkRequest(Long semesterId, String dueDate, Boolean open) {}

    public record ClaimRequest(String token, String studentNumber, String email) {}

    /**
     * Isang row sa Accounts tab. status: "pending" (nag-enroll, hinihintay ang coordinator),
     * "active" (may account na), o "none" (hindi pa nag-enroll)
     */
    public record AccountRow(
            Long studentId,
            Long requestId,
            String studentNumber,
            String lastname,
            String firstname,
            String middleInitial,
            String year,
            String email,
            String status,
            String requestedAt,
            boolean mustChangePassword) {}

    public record AcceptAllResult(int accepted, int skipped) {}

    /** Mga request ID na pinili sa Accounts tab para sa bulk accept/reject */
    public record BulkRequestIds(java.util.List<Long> requestIds) {}

    /** Resulta ng pag-accept/reset; ang temporaryPassword ay ang default password (ID + initials) */
    public record ApprovalResult(
            Long studentId,
            String name,
            String email,
            String temporaryPassword) {}

    public record CreateAccountRequest(String email) {}

    public record ChangePasswordRequest(String currentPassword, String newPassword) {}
}
