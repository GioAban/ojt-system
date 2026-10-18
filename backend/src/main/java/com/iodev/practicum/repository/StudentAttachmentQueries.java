package com.iodev.practicum.repository;

import com.iodev.practicum.model.DocumentRequirementAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StudentAttachmentQueries extends JpaRepository<DocumentRequirementAttachment, Long> {

    @Query("select a from DocumentRequirementAttachment a join fetch a.documentRequirement "
            + "where a.student.id = :studentId")
    List<DocumentRequirementAttachment> findByStudent(@Param("studentId") Long studentId);
}
