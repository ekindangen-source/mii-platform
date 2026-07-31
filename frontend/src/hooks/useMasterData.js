import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../services/api";

export default function useMasterData(
  categories = []
) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");

  const categoryKey = categories.join("|");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/master-data"
      );

      const data = Array.isArray(
        response.data
      )
        ? response.data
        : [];

      setRows(
        data.filter((row) =>
          categories.includes(
            row.category_key
          )
        )
      );
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          "Unable to load dropdown values."
      );
    } finally {
      setLoading(false);
    }
  }, [categoryKey]);

  useEffect(() => {
    load();
  }, [load]);

  const valuesByCategory = useMemo(() => {
    const result = {};

    categories.forEach((category) => {
      result[category] = [];
    });

    rows.forEach((row) => {
      if (!result[row.category_key]) {
        result[row.category_key] = [];
      }

      result[row.category_key].push(
        row.value
      );
    });

    return result;
  }, [rows, categoryKey]);

  return {
    valuesByCategory,
    loading,
    error,
    reload: load,
  };
}
