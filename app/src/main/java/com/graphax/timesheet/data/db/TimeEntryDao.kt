package com.graphax.timesheet.data.db

import androidx.room.*
import com.graphax.timesheet.data.model.TimeEntry
import com.graphax.timesheet.data.model.TimeEntryWithCategory
import kotlinx.coroutines.flow.Flow

@Dao
interface TimeEntryDao {
    @Transaction
    @Query("SELECT * FROM time_entries ORDER BY startTime DESC")
    fun getAllEntriesWithCategory(): Flow<List<TimeEntryWithCategory>>

    @Transaction
    @Query("SELECT * FROM time_entries WHERE endTime IS NULL LIMIT 1")
    fun getActiveEntry(): Flow<TimeEntryWithCategory?>

    @Transaction
    @Query("SELECT * FROM time_entries WHERE endTime IS NULL LIMIT 1")
    suspend fun getActiveEntrySuspend(): TimeEntryWithCategory?

    @Query("SELECT * FROM time_entries WHERE endTime IS NULL LIMIT 1")
    suspend fun getActiveEntryRaw(): TimeEntry?

    @Insert
    suspend fun insert(entry: TimeEntry): Long

    @Update
    suspend fun update(entry: TimeEntry)

    @Delete
    suspend fun delete(entry: TimeEntry)

    @Query("DELETE FROM time_entries WHERE id = :id")
    suspend fun deleteById(id: Long)
}
