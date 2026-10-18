package com.iodev.practicum.repository;

import com.iodev.practicum.model.DocumentRequirementAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface DocumentRequirementAttachmentRepository extends JpaRepository<DocumentRequirementAttachment, Long> {

    @Query("select a.student.id, a.documentRequirement.id, a.status from DocumentRequirementAttachment a "
            + "where a.documentRequirement.id in :requirementIds")
    List<Object[]> findStatuses(@Param("requirementIds") Collection<Long> requirementIds);

    List<DocumentRequirementAttachment> findByStudentIdAndDocumentRequirementId(Long studentId, Long documentRequirementId);

    @Query("select a from DocumentRequirementAttachment a join fetch a.student "
            + "where a.documentRequirement.id = :requirementId order by a.id")
    List<DocumentRequirementAttachment> findForSubmissions(@Param("requirementId") Long requirementId);

    @Query("select a from DocumentRequirementAttachment a "
            + "where a.documentRequirement.id in :requirementIds and a.student.id in :studentIds order by a.id")
    List<DocumentRequirementAttachment> findForBulk(@Param("requirementIds") Collection<Long> requirementIds,
                                                    @Param("studentIds") Collection<Long> studentIds);
}
