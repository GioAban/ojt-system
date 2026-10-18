package com.iodev.practicum.dto;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;

public final class SubmissionDtos {

    private SubmissionDtos() {}

    public record MaterialDto(Long id, String kind, String name, String url, Long size, String contentType) {}

    public record SubmissionFileDto(Long id, String kind, String name, String url) {}

    public record SubmissionStudentDto(
            Long studentId, String studentNumber, String firstname, String lastname,
            String middleInitial, String status, List<SubmissionFileDto> files) {}

    public record SubmissionsResponse(
            Long requirementId, String title, String instructions, Timestamp dueDate,
            boolean archived, String type, List<MaterialDto> materials,
            List<SubmissionStudentDto> students) {}

    public record LinkRequest(String url, String name) {}

    // ---- Weekly report at DTR ----

    public record PeriodStudentDto(
            Long studentId, String studentNumber, String firstname, String lastname,
            String middleInitial, String status, List<SubmissionFileDto> files,
            String rating, BigDecimal hours, String comment) {}

    public record PeriodSubmissionsResponse(
            String kind, Long requirementId, String title, Timestamp dueDate, boolean archived,
            LocalDate dateFrom, LocalDate dateTo, List<PeriodStudentDto> students) {}
}