package com.iodev.practicum.dto;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public final class SectionTrackingDtos {

    private SectionTrackingDtos() {}

    // ---------- Weekly reports ----------
    public record WeeklyColumn(Long id, LocalDate dateFrom, LocalDate dateTo, Timestamp dueDate) {}

    public record WeeklyStudentRow(
            Long id, String studentNumber, String firstname, String lastname,
            String middleInitial, String subjectCode, Map<Long, String> ratings) {}

    public record WeeklyTrackingResponse(
            Long semesterId, List<WeeklyColumn> columns, List<WeeklyStudentRow> students) {}

    public record WeeklyRatingRequest(Long studentId, Long reportId, String rating) {}

    public record WeeklyPeriodRequest(Long semesterId, String dateFrom, String dateTo, String dueDate) {}

    // ---------- DTR ----------
    public record DtrColumn(Long id, String month, Timestamp dueDate) {}

    public record DtrStudentRow(
            Long id, String studentNumber, String firstname, String lastname,
            String middleInitial, String subjectCode, String startedDate,
            BigDecimal trainingDuration, Map<Long, BigDecimal> hours) {}

    public record DtrTrackingResponse(
            Long semesterId, List<DtrColumn> months, List<DtrStudentRow> students) {}

    public record DtrHoursRequest(Long studentId, Long dtrId, BigDecimal hours) {}

    public record DtrHoursResult(BigDecimal hours, BigDecimal totalRendered) {}

    public record DtrMonthRequest(Long semesterId, String month, String dueDate) {}

    public record DtrStartDateRequest(Long studentId, String startDate) {}

    public record DtrStartDateResult(String startedDate) {}
}