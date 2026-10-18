package com.iodev.practicum.repository;

import com.iodev.practicum.model.Program;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProgramRepository extends JpaRepository<Program, Long> {

    @Query("select p.college.id, count(p) from Program p where p.isArchived = false group by p.college.id")
    List<Object[]> countActiveByCollege();

    @Query("select count(p) from Program p where p.college.id = :collegeId and p.isArchived = false")
    long countActiveByCollegeId(@Param("collegeId") Long collegeId);

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);

    boolean existsByAbbreviationIgnoreCase(String abbreviation);

    boolean existsByAbbreviationIgnoreCaseAndIdNot(String abbreviation, Long id);
}