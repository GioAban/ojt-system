package com.iodev.practicum.dto;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Mga DTO ng review ng weekly reports at DTR (status, hours, evaluation, file) */
public final class ReviewDtos {

    private ReviewDtos() {}

    /** Isang cell ng table: status ay ASSIGNED / FOR_CHECKING / CHECKED / INVALID */
    public record ReviewCell(String status, String rating, BigDecimal hours, boolean hasFile) {}

    public record WeeklyCol(Long id, LocalDate dateFrom, LocalDate dateTo, Timestamp dueDate) {}

    public record DtrCol(Long id, String month, Timestamp dueDate) {}

    public record WeeklyStudent(
            Long id, String studentNumber, String firstname, String lastname,
            String middleInitial, String subjectCode, Map<Long, ReviewCell> cells) {}

    public record DtrStudent(
            Long id, String studentNumber, String firstname, String lastname,
            String middleInitial, String subjectCode, String startDate,
            BigDecimal trainingDuration, BigDecimal renderedHours, Map<Long, ReviewCell> cells) {}

    public record WeeklyReview(Long semesterId, List<WeeklyCol> columns, List<WeeklyStudent> students) {}

    public record DtrReview(Long semesterId, List<DtrCol> columns, List<DtrStudent> students) {}

    /** rating: null = huwag galawin, "NONE" = alisin. hours: null = huwag galawin (o alisin kung clearHours) */
    public record CellRequest(
            String kind, Long studentId, Long itemId, String status,
            BigDecimal hours, Boolean clearHours, String rating) {}

    public record CellDetail(String status, String rating, BigDecimal hours, List<String> files, Timestamp updatedAt) {}

    public record CellResult(ReviewCell cell, BigDecimal renderedHours) {}

    public record FileUrl(String url) {}

    /** Isang student sa submissions page ng isang linggo o buwan */
    public record SubmissionCell(
            Long studentId, String status, String rating, BigDecimal hours, boolean hasFile,
            BigDecimal trainingDuration, BigDecimal renderedHours) {}
}
