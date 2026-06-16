package com.graphax.timesheet.ui.history

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.graphax.timesheet.data.model.TimeEntryWithCategory
import com.graphax.timesheet.databinding.ItemHistoryEntryBinding
import com.graphax.timesheet.utils.FormatUtils
import java.text.SimpleDateFormat
import java.util.*

class HistoryAdapter(
    private val onDelete: (TimeEntryWithCategory) -> Unit
) : ListAdapter<TimeEntryWithCategory, HistoryAdapter.VH>(DIFF) {

    private val dateFormat = SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.getDefault())

    inner class VH(private val b: ItemHistoryEntryBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(item: TimeEntryWithCategory) {
            b.tvCategory.text = item.category.name
            b.viewColor.setBackgroundColor(FormatUtils.parseColor(item.category.colorHex))
            b.tvStart.text = dateFormat.format(Date(item.entry.startTime))
            b.tvEnd.text = item.entry.endTime?.let { dateFormat.format(Date(it)) } ?: "Running…"
            b.tvDuration.text = FormatUtils.formatDurationShort(item.durationMs)
            b.btnDelete.setOnClickListener { onDelete(item) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemHistoryEntryBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(getItem(position))

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<TimeEntryWithCategory>() {
            override fun areItemsTheSame(a: TimeEntryWithCategory, b: TimeEntryWithCategory) = a.entry.id == b.entry.id
            override fun areContentsTheSame(a: TimeEntryWithCategory, b: TimeEntryWithCategory) = a == b
        }
    }
}
