package com.iodev.practicum.repository;
import com.iodev.practicum.model.CmsDailyTimeRecord;
import org.springframework.data.jpa.repository.JpaRepository;
public interface CmsDailyTimeRecordRepository extends JpaRepository<CmsDailyTimeRecord, Long> {}