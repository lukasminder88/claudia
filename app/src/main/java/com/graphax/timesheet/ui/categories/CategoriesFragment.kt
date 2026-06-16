package com.graphax.timesheet.ui.categories

import android.os.Bundle
import android.view.*
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import com.graphax.timesheet.databinding.FragmentCategoriesBinding
import com.graphax.timesheet.ui.CategoriesViewModel

class CategoriesFragment : Fragment() {
    private var _binding: FragmentCategoriesBinding? = null
    private val binding get() = _binding!!
    private val viewModel: CategoriesViewModel by viewModels()
    private lateinit var adapter: CategoriesAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentCategoriesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        adapter = CategoriesAdapter(
            onDelete = { viewModel.deleteCategory(it) },
            onEdit = { category ->
                AddCategoryDialog(category) { name, color ->
                    viewModel.updateCategory(category.copy(name = name, colorHex = color))
                }.show(parentFragmentManager, "edit")
            }
        )
        binding.rvCategories.adapter = adapter

        viewModel.categories.observe(viewLifecycleOwner) {
            adapter.submitList(it)
            binding.tvEmpty.visibility = if (it.isEmpty()) View.VISIBLE else View.GONE
        }

        binding.fab.setOnClickListener {
            AddCategoryDialog(null) { name, color ->
                viewModel.addCategory(name, color)
            }.show(parentFragmentManager, "add")
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
