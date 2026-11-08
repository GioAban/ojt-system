package com.iodev.practicum.repository;

import com.iodev.practicum.model.SubmissionFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface SubmissionFileRepository extends JpaRepository<SubmissionFile, Long> {

    List<SubmissionFile> findByStudentIdAndScopeAndRefIdOrderByIdAsc(Long studentId, String scope, Long refId);

    /** Lahat ng (scope, refId) na may nilagay na ang student */
    @Query("select distinct f.scope, f.refId from SubmissionFile f where f.studentId = :studentId")
    List<Object[]> workedOn(@Param("studentId") Long studentId);

    /** student id, ref id ng mga may file na sa mga requirement na ito: para sa mga report */
    @Query("select distinct f.studentId, f.refId from SubmissionFile f where f.scope = :scope and f.refId in :refIds")
    List<Object[]> uploadsFor(@Param("scope") String scope, @Param("refIds") Collection<Long> refIds);

    /** student id, scope, ref id, pinakahuling upload: para sa "late" at sa huling activity ng student */
    @Query("select f.studentId, f.scope, f.refId, max(f.createdAt) from SubmissionFile f "
            + "where f.studentId in :studentIds group by f.studentId, f.scope, f.refId")
    List<Object[]> lastUploads(@Param("studentIds") Collection<Long> studentIds);
}
