package com.iodev.practicum.repository;
import com.iodev.practicum.model.SignedWeeklyReport;
import org.springframework.data.jpa.repository.JpaRepository;
public interface SignedWeeklyReportRepository extends JpaRepository<SignedWeeklyReport, Long> {}