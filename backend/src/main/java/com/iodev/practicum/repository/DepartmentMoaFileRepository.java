package com.iodev.practicum.repository;

import com.iodev.practicum.model.DepartmentMoaFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DepartmentMoaFileRepository extends JpaRepository<DepartmentMoaFile, Long> {

    @Query("select f from DepartmentMoaFile f where f.department.id in :ids order by f.id")
    List<DepartmentMoaFile> findByDepartmentIds(@Param("ids") Collection<Long> ids);

    long countByDepartmentId(Long departmentId);

    Optional<DepartmentMoaFile> findByIdAndDepartmentId(Long id, Long departmentId);
}