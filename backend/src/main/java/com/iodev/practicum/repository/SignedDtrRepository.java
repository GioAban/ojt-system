package com.iodev.practicum.repository;

import com.iodev.practicum.model.SignedDtr;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SignedDtrRepository extends JpaRepository<SignedDtr, Long> {

    @Query("select s.student.id, s.monthlyDtr.id, s.hours from SignedDtr s where s.monthlyDtr.id in :dtrIds")
    List<Object[]> findHours(@Param("dtrIds") Collection<Long> dtrIds);

    /** student id, DTR id, status, hours, file path; ang pinakabago ang huli */
    @Query("select s.student.id, s.monthlyDtr.id, s.status, s.hours, s.filePath from SignedDtr s "
            + "where s.monthlyDtr.id in :dtrIds order by s.id")
    List<Object[]> findCells(@Param("dtrIds") Collection<Long> dtrIds);

    Optional<SignedDtr> findFirstByStudentIdAndMonthlyDtrIdOrderByIdDesc(Long studentId, Long dtrId);

    List<SignedDtr> findByStudentIdAndMonthlyDtrId(Long studentId, Long dtrId);

    @Query("select s from SignedDtr s join fetch s.student where s.monthlyDtr.id = :dtrId order by s.id")
    List<SignedDtr> findForSubmissions(@Param("dtrId") Long dtrId);

    @Query("select s from SignedDtr s where s.monthlyDtr.id = :dtrId and s.student.id in :studentIds order by s.id")
    List<SignedDtr> findForBulk(@Param("dtrId") Long dtrId, @Param("studentIds") Collection<Long> studentIds);

    @Query("select s from SignedDtr s where s.monthlyDtr.id in :dtrIds and s.student.id in :studentIds order by s.id")
    List<SignedDtr> findForBulkMany(@Param("dtrIds") Collection<Long> dtrIds,
                                    @Param("studentIds") Collection<Long> studentIds);

    /** Kabuuang oras ng mga na-check na DTR lang; ang nasa review pa ay hindi pa binibilang */
    @Query("select sum(s.hours) from SignedDtr s where s.student.id = :studentId "
            + "and lower(s.status) = 'checked'")
    BigDecimal totalHours(@Param("studentId") Long studentId);
}
