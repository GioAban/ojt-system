package com.iodev.practicum.repository;

import com.iodev.practicum.model.SubmissionFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SubmissionFileRepository extends JpaRepository<SubmissionFile, Long> {

    List<SubmissionFile> findByStudentIdAndScopeAndRefIdOrderByIdAsc(Long studentId, String scope, Long refId);

    /** Lahat ng (scope, refId) na may nilagay na ang student */
    @Query("select distinct f.scope, f.refId from SubmissionFile f where f.studentId = :studentId")
    List<Object[]> workedOn(@Param("studentId") Long studentId);
}
