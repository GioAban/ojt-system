package com.iodev.practicum.repository;

import com.iodev.practicum.model.SignedWeeklyReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SignedWeeklyReportRepository extends JpaRepository<SignedWeeklyReport, Long> {

    @Query("select s.student.id, s.monthlyWeeklyReport.id, s.supervisorEvaluation from SignedWeeklyReport s "
            + "where s.monthlyWeeklyReport.id in :reportIds")
    List<Object[]> findRatings(@Param("reportIds") Collection<Long> reportIds);

    /** student id, report id, status, supervisor evaluation, file path; ang pinakabago ang huli */
    @Query("select s.student.id, s.monthlyWeeklyReport.id, s.status, s.supervisorEvaluation, s.filePath "
            + "from SignedWeeklyReport s where s.monthlyWeeklyReport.id in :reportIds order by s.id")
    List<Object[]> findCells(@Param("reportIds") Collection<Long> reportIds);

    Optional<SignedWeeklyReport> findFirstByStudentIdAndMonthlyWeeklyReportIdOrderByIdDesc(Long studentId, Long reportId);

    List<SignedWeeklyReport> findByStudentIdAndMonthlyWeeklyReportId(Long studentId, Long reportId);

    @Query("select s from SignedWeeklyReport s join fetch s.student "
            + "where s.monthlyWeeklyReport.id = :reportId order by s.id")
    List<SignedWeeklyReport> findForSubmissions(@Param("reportId") Long reportId);

    @Query("select s from SignedWeeklyReport s "
            + "where s.monthlyWeeklyReport.id in :reportIds and s.student.id in :studentIds order by s.id")
    List<SignedWeeklyReport> findForBulk(@Param("reportIds") Collection<Long> reportIds,
                                         @Param("studentIds") Collection<Long> studentIds);
}
