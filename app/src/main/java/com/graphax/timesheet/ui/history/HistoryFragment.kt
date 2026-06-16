package com.graphax.timesheet.ui.history

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.*
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import com.graphax.timesheet.databinding.FragmentHistoryBinding
import com.graphax.timesheet.ui.HistoryViewModel
import com.graphax.timesheet.utils.CsvExporter

class HistoryFragment : Fragment() {
    private var _binding: FragmentHistoryBinding? = null
    private val binding get() = _binding!!
    private val viewModel: HistoryViewModel by viewModels()
    private lateinit var adapter: HistoryAdapter

    private val requestPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) exportCsv() else Toast.makeText(requireContext(), "Storage permission required", Toast.LENGTH_SHORT).show()
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentHistoryBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        adapter = HistoryAdapter { viewModel.deleteEntry(it) }
        binding.rvHistory.adapter = adapter

        viewModel.entries.observe(viewLifecycleOwner) { entries ->
            adapter.submitList(entries)
            binding.tvEmpty.visibility = if (entries.isEmpty()) View.VISIBLE else View.GONE
        }

        binding.btnExport.setOnClickListener {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
                ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                requestPermission.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            } else {
                exportCsv()
            }
        }
    }

    private fun exportCsv() {
        val entries = viewModel.entries.value ?: return
        if (entries.isEmpty()) {
            Toast.makeText(requireContext(), "No entries to export", Toast.LENGTH_SHORT).show()
            return
        }
        try {
            val path = CsvExporter.export(requireContext(), entries)
            Toast.makeText(requireContext(), "Exported to $path", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Toast.makeText(requireContext(), "Export failed: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
