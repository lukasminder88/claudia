package com.graphax.timesheet.ui.categories

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.graphax.timesheet.data.model.Category
import com.graphax.timesheet.databinding.ItemCategoryBinding
import com.graphax.timesheet.utils.FormatUtils

class CategoriesAdapter(
    private val onDelete: (Category) -> Unit,
    private val onEdit: (Category) -> Unit
) : ListAdapter<Category, CategoriesAdapter.VH>(DIFF) {

    inner class VH(private val b: ItemCategoryBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(cat: Category) {
            b.tvName.text = cat.name
            b.viewColor.setBackgroundColor(FormatUtils.parseColor(cat.colorHex))
            b.btnDelete.setOnClickListener { onDelete(cat) }
            b.root.setOnClickListener { onEdit(cat) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemCategoryBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(getItem(position))

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<Category>() {
            override fun areItemsTheSame(a: Category, b: Category) = a.id == b.id
            override fun areContentsTheSame(a: Category, b: Category) = a == b
        }
    }
}
