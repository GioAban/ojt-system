package com.iodev.practicum.repository;

import com.iodev.practicum.model.SubmissionComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubmissionCommentRepository extends JpaRepository<SubmissionComment, Long> {

    List<SubmissionComment> findByStudentIdAndScopeAndRefIdOrderByIdAsc(Long studentId, String scope, Long refId);
}
