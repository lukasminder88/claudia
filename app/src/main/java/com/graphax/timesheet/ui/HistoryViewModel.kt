package com.graphax.timesheet.ui

import android.app.Application
import androidx.lifecycle.*
import com.graphax.timesheet.data.db.TimesheetDatabase
import com.graphax.timesheet.data.model.TimeEntryWithCategory
import com.graphax.timesheet.data.repository.TimesheetRepository
import kotlinx.coroutines.launch

class HistoryViewModel(app: Application) : AndroidViewModel(app) {
    private val repository: TimesheetRepository

    val entries: LiveData<List<TimeEntryWithCategory>>

    init {
        val db = TimesheetDatabase.getInstance(app)
        repository = TimesheetRepository(db.categoryDao(), db.timeEntryDao())
        entries = repository.allEntriesWithCategory.asLiveData()
    }

    fun deleteEntry(entry: TimeEntryWithCategory) = viewModelScope.launch {
        repository.deleteEntry(entry.entry)
    }
}
