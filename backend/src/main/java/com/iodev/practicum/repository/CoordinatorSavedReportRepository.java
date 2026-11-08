package com.iodev.practicum.repository;

import com.iodev.practicum.model.CoordinatorSavedReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CoordinatorSavedReportRepository extends JpaRepository<CoordinatorSavedReport, Long> {

    /** Listahan na walang laman (maaaring malaki ang JSON) */
    interface SummaryRow {
        Long getId();
        String getReportType();
        String getTitle();
        Long getSemesterId();
        Long getClientUpdatedAt();
        String getLastEditedBy();
    }

    /** Blangkong type o q = walang filter; ang q ay naka-lowercase na at may % */
    @Query("select r.id as id, r.reportType as reportType, r.title as title, r.semesterId as semesterId, "
            + "r.clientUpdatedAt as clientUpdatedAt, r.lastEditedBy as lastEditedBy "
            + "from CoordinatorSavedReport r "
            + "where r.coordinatorId = :coordinatorId and r.semesterId = :semesterId "
            + "and (:type = '' or r.reportType = :type) "
            + "and (:q = '' or lower(r.title) like :q) "
            + "order by r.clientUpdatedAt desc, r.id desc")
    List<SummaryRow> findSummaries(@Param("coordinatorId") Long coordinatorId,
                                   @Param("semesterId") Long semesterId,
                                   @Param("type") String type,
                                   @Param("q") String q);

    Optional<CoordinatorSavedReport> findByIdAndCoordinatorId(Long id, Long coordinatorId);
}
