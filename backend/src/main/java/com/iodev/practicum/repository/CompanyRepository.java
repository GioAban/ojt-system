package com.iodev.practicum.repository;

import com.iodev.practicum.model.Company;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * LAHAT ng listahan ng company ay dumadaan sa findForAssignment o findAllForManagement. Pareho silang
 * hindi kasama ang hiling mula sa company link na hindi pa approved (pending, rejected, merged), kaya
 * hindi ito lumalabas sa Companies tab, student, skills, dashboard, assign, tracking at mga report.
 * Ang null na requestStatus (lahat ng karaniwang company) ay walang pagbabago.
 */
public interface CompanyRepository extends JpaRepository<Company, Long> {

    @Query("select c from Company c left join fetch c.nature "
            + "where c.coordinator.id = :coordinatorId and c.semester.id = :semesterId and c.isArchived = false "
            + "and (c.requestStatus is null or c.requestStatus = 'approved') order by c.name")
    List<Company> findForAssignment(@Param("coordinatorId") Long coordinatorId,
                                    @Param("semesterId") Long semesterId);

    @Query("select c from Company c left join fetch c.nature "
            + "where c.coordinator.id = :coordinatorId and c.semester.id = :semesterId "
            + "and (c.requestStatus is null or c.requestStatus = 'approved') order by c.name")
    List<Company> findAllForManagement(@Param("coordinatorId") Long coordinatorId,
                                       @Param("semesterId") Long semesterId);

    @Query("select count(c) > 0 from Company c "
            + "where c.coordinator.id = :coordinatorId and c.semester.id = :semesterId "
            + "and c.isArchived = false and lower(c.name) = lower(:name) and (c.requestStatus is null or c.requestStatus = 'approved')")
    boolean nameExists(@Param("coordinatorId") Long coordinatorId,
                       @Param("semesterId") Long semesterId,
                       @Param("name") String name);

    @Query("select count(c) > 0 from Company c "
            + "where c.coordinator.id = :coordinatorId and c.semester.id = :semesterId "
            + "and c.isArchived = false and lower(c.name) = lower(:name) and c.id <> :excludeId and (c.requestStatus is null or c.requestStatus = 'approved')")
    boolean nameExistsExcluding(@Param("coordinatorId") Long coordinatorId,
                                @Param("semesterId") Long semesterId,
                                @Param("name") String name,
                                @Param("excludeId") Long excludeId);

    /** Mga hiling mula sa company link (pending, rejected, merged), pinakabago ang una; para sa review lang */
    @Query("select c from Company c left join fetch c.nature "
            + "where c.coordinator.id = :coordinatorId and c.semester.id = :semesterId "
            + "and c.requestSource = 'company_link' and c.requestStatus in ('pending', 'rejected', 'merged') "
            + "order by c.id desc")
    List<Company> findLinkRequests(@Param("coordinatorId") Long coordinatorId,
                                   @Param("semesterId") Long semesterId);

    @Query("select count(c) from Company c where c.coordinator.id = :coordinatorId and c.semester.id = :semesterId "
            + "and c.requestSource = 'company_link' and c.requestStatus = 'pending'")
    long countPendingLinkRequests(@Param("coordinatorId") Long coordinatorId,
                                  @Param("semesterId") Long semesterId);
}
