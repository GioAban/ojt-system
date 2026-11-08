package com.iodev.practicum.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Laman ng Dashboard ng coordinator: isang request lang, para sa isang semester */
public final class DashboardDtos {

    private DashboardDtos() {}

    public record SemesterInfo(Long id, String name) {}

    public record Totals(int students, int companies, int departments) {}

    public record Count(String label, int count) {}

    public record AttentionRow(Long id, String name, int overall, List<String> reasons) {}

    public record AlmostDoneRow(Long id, String name, int overall, BigDecimal remainingHours) {}

    public record UnassignedRow(Long id, String name, String status) {}

    public record InactiveRow(Long id, String name, String status, LocalDateTime lastActivity) {}

    public record NamedRow(Long id, String name) {}

    public record Deployment(int assigned, int unassigned) {}

    public record CompanyRow(Long id, String name, int students, int departments) {}

    public record Timeliness(int onTime, int late, int missing, int notYetDue) {}

    public record MissingItem(String kind, String title, int missing) {}

    public record Submissions(Timeliness requirements, Timeliness dtr, List<MissingItem> mostMissing) {}

    public record Hours(BigDecimal rendered, BigDecimal required, int studentsWithoutDuration,
                        List<NamedRow> withoutDuration) {}

    public record Dashboard(
            SemesterInfo semester,
            LocalDateTime generatedAt,
            Totals totals,
            int averageProgress,
            List<AttentionRow> needsAttention,
            int needsAttentionCount,
            List<AlmostDoneRow> almostDone,
            int almostDoneCount,
            List<UnassignedRow> unassigned,
            Deployment deployment,
            List<InactiveRow> inactive,
            int inactiveCount,
            List<Count> gender,
            List<Count> status,
            List<Count> progressBuckets,
            List<CompanyRow> topCompanies,
            Submissions submissions,
            Hours hours,
            List<Count> employability) {}
}
