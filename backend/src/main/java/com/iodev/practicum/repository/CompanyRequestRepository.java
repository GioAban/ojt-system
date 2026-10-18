package com.iodev.practicum.repository;

import com.iodev.practicum.model.CompanyRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CompanyRequestRepository extends JpaRepository<CompanyRequest, Long> {

    @Query("select r from CompanyRequest r join fetch r.student left join fetch r.existingCompany "
            + "where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId "
            + "order by case when r.status = 'PENDING' then 0 else 1 end, r.createdAt desc")
    List<CompanyRequest> findForCoordinator(@Param("coordinatorId") Long coordinatorId,
                                            @Param("semesterId") Long semesterId);

    @Query("select count(r) from CompanyRequest r "
            + "where r.coordinator.id = :coordinatorId and r.status = 'PENDING'")
    long countPending(@Param("coordinatorId") Long coordinatorId);

    @Query("select count(r) from CompanyRequest r "
            + "where r.coordinator.id = :coordinatorId and r.semester.id = :semesterId and r.status = 'PENDING'")
    long countPendingInSemester(@Param("coordinatorId") Long coordinatorId,
                                @Param("semesterId") Long semesterId);
}
