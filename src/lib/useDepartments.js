"use client";

import { useState, useEffect } from "react";

export function useDepartments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDepartments() {
      try {
        const response = await fetch("/api/departments");
        const json = await response.json();
        if (json.data) {
          setDepartments(json.data.map(d => ({ id: d.id, label: d.name })));
        } else {
          setDepartments([]);
        }
      } catch (err) {
        console.error("Failed to fetch departments:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDepartments();
  }, []);

  return { departments, loading };
}
