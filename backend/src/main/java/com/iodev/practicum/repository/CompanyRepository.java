package com.iodev.practicum.repository;

import com.iodev.practicum.model.Company;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CompanyRepository extends JpaRepository<Company, Long> {

    @Query("select c from Company c left join fetch c.nature "
            + "where c.coordinator.id = :coordinatorId and c.semester.id = :semesterId and c.isArchived = false "
            + "order by c.name")
    List<Company> findForAssignment(@Param("coordinatorId") Long coordinatorId,
                                    @Param("semesterId") Long semesterId);

    @Query("select c from Company c left join fetch c.nature "
            + "where c.coordinator.id = :coordinatorId and c.semester.id = :semesterId "
            + "order by c.name")
    List<Company> findAllForManagement(@Param("coordinatorId") Long coordinatorId,
                                       @Param("semesterId") Long semesterId);

    @Query("select count(c) > 0 from Company c "
            + "where c.coordinator.id = :coordinatorId and c.semester.id = :semesterId "
            + "and c.isArchived = false and lower(c.name) = lower(:name)")
    boolean nameExists(@Param("coordinatorId") Long coordinatorId,
                       @Param("semesterId") Long semesterId,
                       @Param("name") String name);

    @Query("select count(c) > 0 from Company c "
            + "where c.coordinator.id = :coordinatorId and c.semester.id = :semesterId "
            + "and c.isArchived = false and lower(c.name) = lower(:name) and c.id <> :excludeId")
    boolean nameExistsExcluding(@Param("coordinatorId") Long coordinatorId,
                                @Param("semesterId") Long semesterId,
                                @Param("name") String name,
                                @Param("excludeId") Long excludeId);
}
