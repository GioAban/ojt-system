package com.iodev.practicum.repository;

import com.iodev.practicum.model.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface DepartmentRepository extends JpaRepository<Department, Long> {

    @Query("select d from Department d where d.company.id in :companyIds and d.isArchived = false order by d.name")
    List<Department> findActiveByCompanyIds(@Param("companyIds") Collection<Long> companyIds);

    @Query("select d from Department d where d.company.id in :companyIds order by d.name")
    List<Department> findAllByCompanyIds(@Param("companyIds") Collection<Long> companyIds);

    @Query("select count(d) > 0 from Department d "
            + "where d.company.id = :companyId and d.isArchived = false and lower(d.name) = lower(:name)")
    boolean nameExistsInCompany(@Param("companyId") Long companyId, @Param("name") String name);

    @Query("select count(d) > 0 from Department d "
            + "where d.company.id = :companyId and d.isArchived = false and lower(d.name) = lower(:name) "
            + "and d.id <> :excludeId")
    boolean nameExistsInCompanyExcluding(@Param("companyId") Long companyId,
                                         @Param("name") String name,
                                         @Param("excludeId") Long excludeId);
}
