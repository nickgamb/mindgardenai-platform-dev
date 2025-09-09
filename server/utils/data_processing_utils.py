import csv
import io

def create_csv(data, headers=None):
    """
    Creates a CSV string from the provided data.

    Args:
        data (list of lists): A list of lists where each inner list represents a channel's data.
        headers (list): Optional headers for the CSV file.

    Returns:
        str: CSV formatted string.
    """
    if not data or not all(isinstance(channel, list) for channel in data):
        raise ValueError("Invalid data provided. Data should be a list of lists.")

    if not all(len(channel) == len(data[0]) for channel in data):
        raise ValueError("Inconsistent data length across channels.")

    output = io.StringIO()

    try:
        writer = csv.writer(output)

        # Write headers if provided, otherwise default to 'Channel1', 'Channel2', etc.
        if headers:
            writer.writerow(headers)
        else:
            writer.writerow(['Channel' + str(i+1) for i in range(len(data))])

        # Write the data rows
        for row in zip(*data):
            writer.writerow(row)

        output.seek(0)
        return output.getvalue()
    finally:
        output.close()

def save_results(results, filename):
    try:
        # Ensure the 'results' directory exists
        os.makedirs('results', exist_ok=True)

        # Save the results with UTF-8 encoding to handle different characters
        with open(os.path.join('results', filename), 'w', encoding='utf-8') as f:
            f.write(results)

        print(f"Results successfully saved to {filename}")
    except Exception as e:
        print(f"Error saving results: {e}")
        raise
