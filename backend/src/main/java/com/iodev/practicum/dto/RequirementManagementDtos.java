package com.iodev.practicum.dto;

import java.sql.Timestamp;
import java.time.LocalDate;

public final class RequirementManagementDtos {

    private RequirementManagementDtos() {}

    public record Stats(long total, long checked, long forChecking, long invalid) {}

    public record DocumentItem(
            Long id, String title, String instructions, Timestamp dueDate,
            Timestamp createdAt, boolean archived, Stats stats) {}

    public record WeeklyItem(
            Long id, LocalDate dateFrom, LocalDate dateTo, Timestamp dueDate,
            Timestamp createdAt, boolean archived, Stats stats) {}

    public record DtrItem(
            Long id, String month, Timestamp dueDate,
            Timestamp createdAt, boolean archived, Stats stats) {}

    public record DocumentUpdateRequest(String title, String instructions, String dueDate) {}

    public record WeeklyUpdateRequest(String dateFrom, String dateTo, String dueDate) {}

    public record DtrUpdateRequest(String month, String dueDate) {}
}