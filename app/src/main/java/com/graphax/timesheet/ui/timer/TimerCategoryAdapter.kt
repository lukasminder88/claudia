package com.graphax.timesheet.ui.timer

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.graphax.timesheet.data.model.Category
import com.graphax.timesheet.databinding.ItemTimerCategoryBinding
import com.graphax.timesheet.utils.FormatUtils

class TimerCategoryAdapter(
    private val onSelect: (Category) -> Unit
) : ListAdapter<Category, TimerCategoryAdapter.VH>(DIFF) {

    private var selectedId: Long = -1L

    fun setSelected(id: Long) {
        val old = currentList.indexOfFirst { it.id == selectedId }
        val new = currentList.indexOfFirst { it.id == id }
        selectedId = id
        if (old >= 0) notifyItemChanged(old)
        if (new >= 0) notifyItemChanged(new)
    }

    inner class VH(private val b: ItemTimerCategoryBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(category: Category) {
            b.tvName.text = category.name
            b.viewColor.setBackgroundColor(FormatUtils.parseColor(category.colorHex))
            b.root.isSelected = category.id == selectedId
            b.root.alpha = if (category.id == selectedId) 1f else 0.7f
            b.root.setOnClickListener { onSelect(category) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemTimerCategoryBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(getItem(position))

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<Category>() {
            override fun areItemsTheSame(a: Category, b: Category) = a.id == b.id
            override fun areContentsTheSame(a: Category, b: Category) = a == b
        }
    }
}
