package com.iodev.practicum.repository;

import com.iodev.practicum.model.IssueAndConcern;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IssueAndConcernRepository extends JpaRepository<IssueAndConcern, Long> {
}